import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { CollabTokenResponse, SceneDataJson } from '@/types/collab.types';
import type { TextWorkbenchNode } from '@/types';
import { useStore } from '@/store/useStore';
import { createSceneDoc, seedSceneFromJson, extractSceneFromDoc, jsonToYValue } from '@/services/collab/sceneDocMapping';
import { useCollabSession, type UseCollabSessionOptions } from './useCollabSession';

const PROJECT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const OTHER_PROJECT_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

/** Minimal stand-in for HocuspocusProvider — records wiring, no network. */
class FakeAwareness {
    clientID = 1;
    local: Record<string, unknown> = {};
    states = new Map<number, Record<string, unknown>>([[1, {}]]);

    getLocal(): Record<string, unknown> {
        return this.local;
    }

    getStates(): Map<number, Record<string, unknown>> {
        return this.states;
    }
}

type StatusListener = (event: { status: string }) => void;

class FakeProvider {
    static instances: FakeProvider[] = [];
    config: Record<string, unknown>;
    awareness = new FakeAwareness();
    private statusListeners: StatusListener[] = [];
    private syncedListeners: Array<() => void> = [];
    destroyed = false;

    constructor(config: Record<string, unknown>) {
        this.config = config;
        FakeProvider.instances.push(this);
    }

    on(event: string, listener: StatusListener | (() => void)): this {
        if (event === 'status') this.statusListeners.push(listener as StatusListener);
        if (event === 'synced') this.syncedListeners.push(listener as () => void);
        return this;
    }

    /** Test helper: simulate the provider reporting a new connection status. */
    emitStatus(status: string): void {
        for (const listener of this.statusListeners) listener({ status });
    }

    connect(): void {
        // Report connected, then synced, on later microtasks — like the real transport.
        queueMicrotask(() => this.emitStatus('connected'));
        queueMicrotask(() => {
            for (const listener of this.syncedListeners) listener();
        });
    }

    disconnect(): void {
        /* no-op */
    }

    destroy(): void {
        this.destroyed = true;
    }
}

beforeEach(() => {
    FakeProvider.instances = [];
    vi.restoreAllMocks();
    useStore.setState({
        workbenchNodes: [],
        connections: [],
        activeWorkbenchGesture: null,
        collabSessionActive: false,
    });
});

function seedOptions(overrides: Partial<UseCollabSessionOptions> = {}, doc = createSceneDoc()): UseCollabSessionOptions {
    return {
        projectId: PROJECT_ID,
        userId: 'u-alice',
        userName: 'Alice',
        serverUrl: 'ws://localhost:1234',
        getToken: vi.fn().mockResolvedValue({
            token: 'tok.abc',
            sceneId: 'scene-main-1',
            projectId: PROJECT_ID,
            expiresAt: Date.now() + 300_000,
        } satisfies CollabTokenResponse),
        createProvider: (config) => {
            const provider = new FakeProvider(config as unknown as Record<string, unknown>);
            return { provider, doc, origin: `user:${config.userId}`, destroy: () => provider.destroy() };
        },
        ...overrides,
    };
}

describe('useCollabSession lifecycle', () => {
    it('stays idle and never fetches a token without a project', async () => {
        const options = seedOptions({ projectId: null });
        const { result } = renderHook(() => useCollabSession(options));

        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(options.getToken).not.toHaveBeenCalled();
        expect(FakeProvider.instances).toHaveLength(0);
    });

    it('fetches a room token and joins the scene room named by the main scene ID', async () => {
        const options = seedOptions();
        const { result } = renderHook(() => useCollabSession(options));

        await waitFor(() => expect(result.current.status).toBe('connected'));
        expect(options.getToken).toHaveBeenCalledWith(PROJECT_ID);
        expect(FakeProvider.instances).toHaveLength(1);
        expect(FakeProvider.instances[0].config).toMatchObject({
            url: 'ws://localhost:1234',
            token: 'tok.abc',
            name: 'scene-main-1',
        });
    });

    it('projects the shared document into the workbench store once connected', async () => {
        // Real persisted shape: flat x/y, from/to connections. image→render is
        // the only direction the connection policy allows.
        const scene: SceneDataJson = {
            nodes: [
                { id: 'n2', type: 'render', x: 5, y: 6, data: {} },
                { id: 'n1', type: 'image', x: 1, y: 2, data: { alt: 'a' } },
            ],
            connections: [{ id: 'c1', from: 'n1', to: 'n2' }],
        };
        const doc = createSceneDoc();
        seedSceneFromJson(doc, scene);
        const options = seedOptions({}, doc);

        const { result } = renderHook(() => useCollabSession(options));
        await waitFor(() => expect(result.current.status).toBe('connected'));

        const state = useStore.getState();
        expect(state.workbenchNodes.map((n) => n.id)).toEqual(['n1', 'n2']); // canonical ID order
        expect(state.connections).toHaveLength(1);
        expect(state.connections[0]).toMatchObject({ id: 'c1', from: 'n1', to: 'n2' });
        expect(state.collabSessionActive).toBe(true);
    });

    it('projects remote document changes into the store', async () => {
        const doc = createSceneDoc();
        seedSceneFromJson(doc, { nodes: [{ id: 'n1', x: 0, y: 0 }], connections: [] });
        const options = seedOptions({}, doc);

        const { result } = renderHook(() => useCollabSession(options));
        await waitFor(() => expect(result.current.status).toBe('connected'));
        expect(useStore.getState().workbenchNodes.map((n) => n.id)).toEqual(['n1']);

        // A peer adds a node (different origin).
        act(() => {
            doc.transact(() => {
                const nodes = doc.getMap('nodes');
                nodes.set('n9', jsonToYValue({ id: 'n9', x: 42, y: 43 }));
            }, 'user:bob');
        });

        await waitFor(() => {
            expect(useStore.getState().workbenchNodes.map((n) => n.id).sort()).toEqual(['n1', 'n9']);
        });
    });

    it('pushes local store edits into the shared document with the user origin', async () => {
        const doc = createSceneDoc();
        seedSceneFromJson(doc, { nodes: [{ id: 'n1', x: 0, y: 0 }], connections: [] });
        const options = seedOptions({}, doc);

        const { result } = renderHook(() => useCollabSession(options));
        await waitFor(() => expect(result.current.status).toBe('connected'));

        act(() => {
            const moved: TextWorkbenchNode = {
                id: 'n1',
                type: 'text',
                x: 7,
                y: 8,
                data: { text: 'moved', fontSize: 14, color: '#fff' },
            };
            useStore.getState().setWorkbenchNodes([moved]);
        });

        await waitFor(() => {
            const extracted = extractSceneFromDoc(doc) as SceneDataJson;
            const node = extracted.nodes.find((n) => n.id === 'n1');
            expect(node?.x).toBe(7);
            expect(node?.y).toBe(8);
        });
    });

    it('tears down the old session on project switch and everything on unmount', async () => {
        const options = seedOptions();
        const { result, rerender, unmount } = renderHook((props: UseCollabSessionOptions) => useCollabSession(props), {
            initialProps: options,
        });

        await waitFor(() => expect(result.current.status).toBe('connected'));
        const firstProvider = FakeProvider.instances[0];

        // Project switch destroys the old session and joins the new project's room.
        rerender(seedOptions({ projectId: OTHER_PROJECT_ID }));
        await waitFor(() => expect(FakeProvider.instances).toHaveLength(2));
        expect(firstProvider.destroyed).toBe(true);
        await waitFor(() => expect(result.current.status).toBe('connected'));

        // Unmount tears down the remaining session.
        unmount();
        expect(FakeProvider.instances[1].destroyed).toBe(true);
    });
});

