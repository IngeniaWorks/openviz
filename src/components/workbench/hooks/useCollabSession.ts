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

        const applyToStore = (scene: SceneDataJson): void => {
            const state = useStore.getState();
            state.setWorkbenchNodes(scene.nodes as unknown as WorkbenchNode[]);
            state.setConnections(scene.connections as unknown as Connection[]);
        };

        setStatus('connecting');

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
                });
                handle.provider.on('status', (event) => {
                    if (cancelled) return;
                    setStatus(event.status === 'connected' ? 'connected' : 'connecting');
                });

                setDoc(handle.doc);
                setOrigin(handle.origin);
                void handle.provider.connect();
            } catch (error) {
                console.error('Failed to join collaboration session:', error);
                if (!cancelled) setStatus('idle');
            }
        })();

        return () => {
            cancelled = true;
            sync?.stop();
            unsubscribeUndo?.();
            undoRef.current?.destroy();
            undoRef.current = null;
            handle?.destroy();
            useStore.getState().setCollabSessionActive(false);
            setDoc(null);
            setOrigin(null);
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

    return { status, doc, origin, undo, redo, canUndo: undoState.canUndo, canRedo: undoState.canRedo };
}
