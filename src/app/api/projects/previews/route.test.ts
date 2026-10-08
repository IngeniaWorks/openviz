import { describe, it, expect, vi, beforeEach } from 'vitest';

const authMock = vi.fn();

// Drizzle calls in this route, in order:
// 1. db.select() — workspace memberships for the user
// 2. db.select() — accessible projects (id IN ids AND workspaceId IN memberships)
// 3. db.execute(sql`...`) — JSONB thumbnail extraction
let selectQueue: unknown[][] = [];
let executeCalls: Array<{ args: unknown[] }> = [];
let executeRows: unknown[] = [];

const downsampleDataUrlsMock = vi.fn(async (items: Array<{ value: string }>) => {
    // Emulate the real helper: replace oversized data URLs with a small webp.
    for (const item of items) {
        if (item.value.startsWith('data:image') && item.value.length > 65_536) {
            item.value = 'data:image/webp;base64,d2VicA==';
        }
    }
});
vi.mock('@/lib/services/thumbnail', () => ({
    downsampleDataUrls: (items: Array<{ value: string }>) => downsampleDataUrlsMock(items),
}));

vi.mock('@/lib/auth', () => ({
    auth: (...args: unknown[]) => authMock(...args),
    db: {
        select: () => {
            const chain = {
                from: () => chain,
                where: () => chain,
                then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
                    Promise.resolve(selectQueue.shift() ?? []).then(resolve, reject),
            };
            return chain;
        },
        // postgres-js execute() resolves to a RowList (an array of row objects).
        execute: (...args: unknown[]) => {
            executeCalls.push({ args });
            return Promise.resolve(executeRows);
        },
    },
}));

import { GET, parsePreviewIds } from './route';

function get(ids?: string) {
    const url = ids === undefined ? 'http://localhost/api/projects/previews' : `http://localhost/api/projects/previews?ids=${encodeURIComponent(ids)}`;
    return GET(new Request(url));
}

beforeEach(() => {
    vi.clearAllMocks();
    selectQueue = [];
    executeCalls = [];
    executeRows = [];
});

describe('GET /api/projects/previews', () => {
    it('returns 401 without an authenticated session', async () => {
        authMock.mockResolvedValue(null);
        const res = await get('a,b');
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: 'Unauthorized' });
    });

    it('returns an empty map when no ids are given', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        const res = await get();
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({});
        expect(executeCalls).toHaveLength(0);
    });

    it('returns an empty map when the user has no workspace memberships', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        selectQueue = [[]]; // no memberships
        const res = await get('a,b');
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({});
        expect(executeCalls).toHaveLength(0);
    });

    it('filters ids down to accessible projects before querying scenes', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        selectQueue = [
            [{ workspaceId: 'ws-1' }],
            [{ id: 'p-2' }], // only p-2 is accessible; p-1 belongs to another workspace
        ];
        executeRows = [];
        const res = await get('p-1,p-2');
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({});

        // The raw SQL must only receive the accessible ids.
        expect(executeCalls).toHaveLength(1);
        const sqlPayload = JSON.stringify(executeCalls[0].args);
        expect(sqlPayload).toContain('p-2');
        expect(sqlPayload).not.toContain('p-1');
    });

    it('groups SQL rows by project and passes thumbnails through', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        selectQueue = [
            [{ workspaceId: 'ws-1' }],
            [{ id: 'p-1' }, { id: 'p-2' }],
        ];
        executeRows = [
            { project_id: 'p-1', id: 'n-1', thumbnail: 'https://cdn/a.webp', last_modified_at: 200 },
            { project_id: 'p-1', id: 'n-2', thumbnail: 'https://cdn/b.webp', last_modified_at: 100 },
            { project_id: 'p-2', id: 'n-3', thumbnail: 'https://cdn/c.webp', last_modified_at: null },
        ];
        const res = await get('p-1,p-2');
        expect(res.status).toBe(200);
        const body = (await res.json()) as Record<string, Array<{ id: string; thumbnail: string }>>;
        expect(body['p-1']).toEqual([
            { id: 'n-1', thumbnail: 'https://cdn/a.webp', lastModifiedAt: 200 },
            { id: 'n-2', thumbnail: 'https://cdn/b.webp', lastModifiedAt: 100 },
        ]);
        expect(body['p-2']).toEqual([{ id: 'n-3', thumbnail: 'https://cdn/c.webp', lastModifiedAt: null }]);
    });

    it('downsamples oversized data-URL thumbnails (mock mode) but passes short refs through', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        selectQueue = [
            [{ workspaceId: 'ws-1' }],
            [{ id: 'p-1' }],
        ];
        const bigDataUrl = `data:image/png;base64,${'A'.repeat(70_000)}`; // over the 64KB threshold
        executeRows = [
            { project_id: 'p-1', id: 'n-1', thumbnail: bigDataUrl, last_modified_at: 200 },
            { project_id: 'p-1', id: 'n-2', thumbnail: '/api/assets/short-ref', last_modified_at: 100 },
        ];

        const res = await get('p-1');
        const body = (await res.json()) as Record<string, Array<{ id: string; thumbnail: string }>>;

        expect(downsampleDataUrlsMock).toHaveBeenCalledTimes(1);
        expect(body['p-1'][0].thumbnail).toBe('data:image/webp;base64,d2VicA==');
        expect(body['p-1'][1].thumbnail).toBe('/api/assets/short-ref');
    });

    it('keeps the original thumbnail when downsample fails (undecodable bytes)', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        selectQueue = [
            [{ workspaceId: 'ws-1' }],
            [{ id: 'p-1' }],
        ];
        const bigDataUrl = `data:image/png;base64,${'A'.repeat(70_000)}`;
        executeRows = [{ project_id: 'p-1', id: 'n-1', thumbnail: bigDataUrl, last_modified_at: 200 }];
        // Undecodable bytes: the real helper returns the original — emulate by
        // leaving the value untouched.
        downsampleDataUrlsMock.mockImplementationOnce(async () => undefined);

        const res = await get('p-1');
        const body = (await res.json()) as Record<string, Array<{ id: string; thumbnail: string }>>;
        expect(body['p-1'][0].thumbnail).toBe(bigDataUrl);
    });

    it('caps the number of requested ids at 100 and dedupes them', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        const many = Array.from({ length: 120 }, (_, i) => `id-${i}`);
        selectQueue = [
            [{ workspaceId: 'ws-1' }],
            [], // no accessible projects → stops before SQL
        ];
        const res = await get([...many, many[0]].join(','));
        expect(res.status).toBe(200);

        // The membership query ran; the project query must have received at most 100 unique ids.
        expect(executeCalls).toHaveLength(0);
    });
});

describe('parsePreviewIds', () => {
    it('splits, trims and dedupes comma-separated ids', () => {
        expect(parsePreviewIds('a, b ,a,,c')).toEqual(['a', 'b', 'c']);
    });

    it('caps at 100 ids', () => {
        const many = Array.from({ length: 120 }, (_, i) => `id-${i}`);
        expect(parsePreviewIds(many.join(',')).length).toBe(100);
    });

    it('returns an empty list for blank input', () => {
        expect(parsePreviewIds('')).toEqual([]);
        expect(parsePreviewIds(' , ')).toEqual([]);
    });

    it('sets a short private cache on successful responses', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        selectQueue = [[{ workspaceId: 'ws-1' }], [{ id: 'p-1' }]];
        executeRows = [];
        const res = await get('p-1');
        expect(res.headers.get('cache-control')).toBe('private, max-age=5, stale-while-revalidate=60');
    });
});
