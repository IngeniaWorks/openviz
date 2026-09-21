import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import type { CollabSessionStatus, CollabTokenResponse, SceneDataJson } from '@/types/collab.types';
import type { Connection, WorkbenchNode } from '@/types';
import { useStore } from '@/store/useStore';
import { createCollabProvider } from '@/services/collab/collabProviderFactory';
import { createCollabStoreSync, type CollabStoreSync } from '@/services/collab/collabStoreSync';
import { createCollabUndoManager, type CollabUndoManager } from '@/services/collab/undoOrigin';

/**
 * Structural view of the collaboration provider — everything the session hook
 * needs. The real HocuspocusProvider satisfies this; tests inject fakes.
 */
export interface CollabProviderLike {
    on(event: 'status', listener: (event: { status: string }) => void): unknown;
    on(event: 'synced', listener: () => void): unknown;
    on(event: 'maxAttemptsFailed', listener: () => void): unknown;
    /** Awareness publishing (presence/cursors/soft locks, US2). */
    setAwarenessField(key: string, value: unknown): void;
    connect(): void | Promise<unknown>;
    disconnect(): void;
    destroy(): void;
}

/** Request the session hook hands to the provider factory. */
export interface CollabProviderRequest {
    url: string;
    token: string;
    /** Room name — the project's main scene ID. */
    name: string;
    userId: string;
    userName: string;
}

/** Handle returned by a provider factory (real or injected). */
export interface CollabSessionHandle {
    provider: CollabProviderLike;
    doc: Y.Doc;
    origin: string;
    destroy(): void;
}

export type CreateCollabProvider = (request: CollabProviderRequest) => CollabSessionHandle;

export interface UseCollabSessionOptions {
    projectId: string | null;
    userId: string;
    userName: string;
    /** Collaboration server WebSocket URL, e.g. ws://localhost:1234 (env-driven). */
    serverUrl: string;
    /** Injectable token fetcher (defaults to the collab-token API route). */
    getToken?: (projectId: string) => Promise<CollabTokenResponse>;
    /** Injectable provider factory (defaults to the Hocuspocus stack). */
    createProvider?: CreateCollabProvider;
}

export interface UseCollabSessionResult {
    status: CollabSessionStatus;
    doc: Y.Doc | null;
    origin: string | null;
    /** Live provider while a session is joining/active — used for awareness publishing. */
    provider: CollabProviderLike | null;
    userId: string;
    userName: string;
    undo(): void;
    redo(): void;
    canUndo: boolean;
    canRedo: boolean;
}

async function fetchRoomToken(projectId: string): Promise<CollabTokenResponse> {
    const response = await fetch(`/api/projects/${projectId}/scenes/collab-token`, { method: 'POST' });
    if (!response.ok) {
        throw new Error(`Failed to fetch collaboration token (HTTP ${response.status})`);
    }
    return (await response.json()) as CollabTokenResponse;
}

const defaultCreateProvider: CreateCollabProvider = (request) => {
    const handle = createCollabProvider({
        url: request.url,
        token: request.token,
        sceneId: request.name,
        userId: request.userId,
        userName: request.userName,
    });
    return { provider: handle.provider, doc: handle.doc, origin: handle.origin, destroy: handle.destroy };
};

/**
 * Owns the real-time collaboration session for the current project's main
 * scene: token fetch → provider join → bidirectional store sync → teardown.
 *
 * The bridge starts only after the provider reports `synced` so an empty
 * pre-sync document can never blank a freshly hydrated canvas.
 */
export function useCollabSession(options: UseCollabSessionOptions): UseCollabSessionResult {
    const { projectId, userId, userName, serverUrl } = options;
    const getToken = options.getToken ?? fetchRoomToken;
    const createProvider = options.createProvider ?? defaultCreateProvider;

    const [status, setStatus] = useState<CollabSessionStatus>('idle');
    const [doc, setDoc] = useState<Y.Doc | null>(null);
    const [origin, setOrigin] = useState<string | null>(null);
    const [provider, setProvider] = useState<CollabProviderLike | null>(null);
    const [undoState, setUndoState] = useState({ canUndo: false, canRedo: false });
    const undoRef = useRef<CollabUndoManager | null>(null);

    useEffect(() => {
        if (!projectId) {
            setStatus('idle');
            return;
        }

        let cancelled = false;
        let handle: CollabSessionHandle | null = null;
        let sync: CollabStoreSync | null = null;
        let unsubscribeUndo: (() => void) | null = null;
        let sessionStatus: CollabSessionStatus = 'connecting';

        const updateStatus = (next: CollabSessionStatus): void => {
            if (cancelled) return;
            sessionStatus = next;
            setStatus(next);
        };

        // Frozen/suspended tabs can exhaust the provider's retry budget while
        // away (background throttling). When the user comes back, re-trigger
        // the connection so the state-vector sync delivers everything missed —
        // the resulting doc update re-projects the store from the server.
        const handleVisibilityChange = (): void => {
            if (cancelled || !handle) return;
            if (document.visibilityState !== 'visible') return;
            if (sessionStatus === 'connected') return;
            void handle.provider.connect();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const applyToStore = (scene: SceneDataJson): void => {
            const state = useStore.getState();
            // A remote projection must not yank a node that is mid-gesture
            // back to its pre-drag position — keep the in-flight transient
            // position for affected nodes; the gesture commit flushes the
            // final value afterwards (last-write-wins per field).
            const protectedIds = state.activeWorkbenchGesture?.affectedNodeIds ?? [];
            const nodes = scene.nodes.map((node) => {
                if (!protectedIds.includes(node.id)) return node;
                const live = state.workbenchNodes.find((candidate) => candidate.id === node.id);
                return live ? { ...node, x: live.x, y: live.y } : node;
            });
            state.setWorkbenchNodes(nodes as unknown as WorkbenchNode[]);
            state.setConnections(scene.connections as unknown as Connection[]);
        };

        updateStatus('connecting');

        void (async () => {
            try {
                const tokenResponse = await getToken(projectId);
                if (cancelled) return;

                handle = createProvider({
                    url: serverUrl,
                    token: tokenResponse.token,
                    name: tokenResponse.sceneId,
                    userId,
                    userName,
                });

                sync = createCollabStoreSync({
                    doc: handle.doc,
                    origin: handle.origin,
                    getStoreState: () => {
                        const state = useStore.getState();
                        return {
                            nodes: state.workbenchNodes,
                            connections: state.connections,
                            gestureActive: state.activeWorkbenchGesture !== null,
                        };
                    },
                    getActiveGestureNodeIds: () => {
                        return useStore.getState().activeWorkbenchGesture?.affectedNodeIds ?? null;
                    },
                    applyToStore,
                    subscribeStore: (listener) => useStore.subscribe(listener),
                });

                const undoManager = createCollabUndoManager(handle.doc, handle.origin);
                undoRef.current = undoManager;
                unsubscribeUndo = undoManager.subscribe(() => {
                    setUndoState({ canUndo: undoManager.canUndo(), canRedo: undoManager.canRedo() });
                });

                // The document is only safe to project after the initial sync.
                handle.provider.on('synced', () => {
                    if (cancelled || !sync) return;
                    useStore.getState().setCollabSessionActive(true);
                    sync.start();
                    console.info('[collab] synced — live co-editing active for scene', tokenResponse.sceneId);
                });
                handle.provider.on('status', (event) => {
                    const next = event.status === 'connected' ? 'connected' : 'connecting';
                    if (next !== sessionStatus) console.info('[collab] status:', next);
                    updateStatus(next);
                });
                handle.provider.on('maxAttemptsFailed', () => {
                    updateStatus('failed');
                });

                setDoc(handle.doc);
                setOrigin(handle.origin);
                setProvider(handle.provider);
                void handle.provider.connect();
            } catch (error) {
                console.error('Failed to join collaboration session:', error);
                updateStatus('idle');
            }
        })();

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            sync?.stop();
            unsubscribeUndo?.();
            undoRef.current?.destroy();
            undoRef.current = null;
            handle?.destroy();
            useStore.getState().setCollabSessionActive(false);
            setDoc(null);
            setOrigin(null);
            setProvider(null);
            setUndoState({ canUndo: false, canRedo: false });
            setStatus('idle');
        };
    }, [projectId, userId, userName, serverUrl, getToken, createProvider]);

    const undo = useCallback(() => {
        undoRef.current?.undo();
    }, []);

    const redo = useCallback(() => {
        undoRef.current?.redo();
    }, []);

    return { status, doc, origin, provider, userId, userName, undo, redo, canUndo: undoState.canUndo, canRedo: undoState.canRedo };
}
