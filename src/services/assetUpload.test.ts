import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/services/imageSource', () => ({
    blobToDataUrl: vi.fn(async (blob: Blob) => `data:${blob.type};base64,FAKE`),
}));

const UPLOAD_URL = 'http://s3.local/uploads/u1/123-pic.png';
const THUMB_PATH = '/api/assets/thumbnail';

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('uploadBlobToAsset (Sprint 3 asset delivery)', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (url === '/api/assets/upload-url') {
                return jsonResponse({ uploadUrl: UPLOAD_URL, key: 'uploads/u1/123-pic.png' });
            }
            if (url === UPLOAD_URL) {
                expect(init?.method).toBe('PUT');
                return new Response(null, { status: 200 });
            }
            if (url.startsWith(THUMB_PATH)) {
                return jsonResponse({ thumbnailUrl: '/api/assets/thumb-token' });
            }
            throw new Error(`unexpected fetch: ${url}`);
        });
        vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns full + thumbnail refs and sends the immutable Cache-Control header on the PUT', async () => {
        const { uploadBlobToAsset } = await import('./assetUpload');
        const blob = new Blob(['x'], { type: 'image/png' });

        const result = await uploadBlobToAsset(blob, 'pic.png');

        expect(result.url).toBe('/api/assets/' + Buffer.from('uploads/u1/123-pic.png', 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
        expect(result.thumbnailUrl).toBe('/api/assets/thumb-token');

        const putCall = fetchMock.mock.calls.find((c) => String(c[0]) === UPLOAD_URL)!;
        const headers = (putCall[1]?.headers ?? {}) as Record<string, string>;
        expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');

        const thumbCall = fetchMock.mock.calls.find((c) => String(c[0]).startsWith(THUMB_PATH))!;
        expect(JSON.parse(String(thumbCall[1]?.body))).toEqual({ key: 'uploads/u1/123-pic.png' });
    });

    it('skips thumbnail generation for non-image uploads', async () => {
        const { uploadBlobToAsset } = await import('./assetUpload');
        const blob = new Blob(['x'], { type: 'video/mp4' });

        const result = await uploadBlobToAsset(blob, 'clip.mp4');

        expect(result.thumbnailUrl).toBeNull();
        expect(fetchMock.mock.calls.some((c) => String(c[0]).startsWith(THUMB_PATH))).toBe(false);
    });

    it('still returns the full url when thumbnail generation fails', async () => {
        fetchMock.mockImplementationOnce(async () => jsonResponse({ uploadUrl: UPLOAD_URL, key: 'uploads/u1/123-pic.png' }));
        fetchMock.mockImplementationOnce(async () => new Response(null, { status: 200 }));
        fetchMock.mockImplementationOnce(async () => new Response('boom', { status: 500 }));

        const { uploadBlobToAsset } = await import('./assetUpload');
        const result = await uploadBlobToAsset(new Blob(['x'], { type: 'image/png' }), 'pic.png');

        expect(result.thumbnailUrl).toBeNull();
        expect(result.url).toContain('/api/assets/');
    });

    it('falls back to an inline data URL when the asset store is unavailable', async () => {
        fetchMock.mockImplementationOnce(async () => new Response('nope', { status: 503 }));

        const { uploadBlobToAsset } = await import('./assetUpload');
        const result = await uploadBlobToAsset(new Blob(['x'], { type: 'image/png' }), 'pic.png');

        expect(result.url).toBe('data:image/png;base64,FAKE');
        expect(result.thumbnailUrl).toBeNull();
    });
});
