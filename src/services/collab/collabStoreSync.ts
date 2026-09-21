import * as Y from 'yjs';
import type { SceneDataJson, SceneJsonValue } from '@/types/collab.types';
import { extractSceneFromDoc, getConnectionsMap, getNodesMap, jsonToYValue, yValueToJson } from './sceneDocMapping';

/**
 * Bidirectional sync bridge between the workbench store and the shared scene
 * document while a collaboration session is active.
 *
 * Direction doc → store: every document update (local or remote) re-projects
 * the canonical scene into the store under a re-entrancy guard.
 *
 * Direction store → doc: store changes are diffed against the last synced
 * scene and applied as ONE origin-tagged transaction per change burst. While
 * a workbench gesture is active (drag/resize) changes are buffered and flushed
 * exactly once on gesture commit — preserving feature 002's one-gesture-one-
 * action semantics in the shared document.
 */

export interface CollabStoreSyncDeps {
    doc: Y.Doc;
    /** This client's transaction origin (`user:<id>`). */
    origin: string;
    getStoreState(): { nodes: readonly SceneNodeLike[]; connections: readonly SceneConnectionLike[]; gestureActive: boolean };
    applyToStore(scene: SceneDataJson): void;
    subscribeStore(listener: () => void): () => void;
}

/** Minimal structural view of a store node (WorkbenchNode satisfies this). */
export interface SceneNodeLike {
    id: string;
}

/** Minimal structural view of a store connection (Connection satisfies this). */
export interface SceneConnectionLike {
    id: string;
}

export interface CollabStoreSync {
    start(): void;
    stop(): void;
}

/** Stable JSON for deep comparison — key order must not create false diffs. */
function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function canonicalScene<T extends { id: string }>(items: readonly T[]): T[] {
    return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function createCollabStoreSync(deps: CollabStoreSyncDeps): CollabStoreSync {
    const { doc, origin } = deps;
    let projecting = false;
    let lastDocScene: SceneDataJson | null = null;
    let unsubscribeStore: (() => void) | null = null;

    const handleDocUpdate = (_bytes: Uint8Array, _updateOrigin: unknown): void => {
        if (projecting) return;
        const scene = extractSceneFromDoc(doc);
        lastDocScene = scene;
        projecting = true;
        try {
            deps.applyToStore(scene);
        } finally {
            projecting = false;
        }
    };

    const flushToDoc = (): void => {
        const { nodes, connections } = deps.getStoreState();
        const storeScene = {
            nodes: canonicalScene(nodes) as SceneDataJson['nodes'],
            connections: canonicalScene(connections) as SceneDataJson['connections'],
        };
        if (lastDocScene && stableStringify(storeScene) === stableStringify(lastDocScene)) return;

        doc.transact(() => {
            const nodesMap = getNodesMap(doc);
            const liveNodeIds = new Set<string>();
            for (const node of storeScene.nodes) {
                liveNodeIds.add(node.id);
                const existing = yValueToJson(nodesMap.get(node.id));
                if (stableStringify(existing) !== stableStringify(node)) {
                    nodesMap.set(node.id, jsonToYValue(node as unknown as SceneJsonValue));
                }
            }
            for (const key of Array.from(nodesMap.keys())) {
                if (!liveNodeIds.has(key)) nodesMap.delete(key);
            }

            const connectionsMap = getConnectionsMap(doc);
            const liveConnectionIds = new Set<string>();
            for (const connection of storeScene.connections) {
                liveConnectionIds.add(connection.id);
                const existing = yValueToJson(connectionsMap.get(connection.id));
                if (stableStringify(existing) !== stableStringify(connection)) {
                    connectionsMap.set(connection.id, jsonToYValue(connection as unknown as SceneJsonValue));
                }
            }
            for (const key of Array.from(connectionsMap.keys())) {
                if (!liveConnectionIds.has(key)) connectionsMap.delete(key);
            }
        }, origin);

        // The transact fired handleDocUpdate synchronously (re-projecting the
        // merged state, including any concurrent remote changes). Re-read the
        // authoritative post-merge scene as the new diff baseline.
        lastDocScene = extractSceneFromDoc(doc);
    };

    const handleStoreChange = (): void => {
        if (projecting) return;
        const { nodes, connections, gestureActive } = deps.getStoreState();
        const storeScene = {
            nodes: canonicalScene(nodes),
            connections: canonicalScene(connections),
        };
        if (lastDocScene && stableStringify(storeScene) === stableStringify(lastDocScene)) return;

        if (gestureActive) {
            // Buffer: the whole gesture flushes as ONE origin-tagged transaction
            // on the next store change after the gesture commits.
            return;
        }
        void flushToDoc();
    };

    return {
        start(): void {
            // Project the current document state immediately (initial sync).
            lastDocScene = extractSceneFromDoc(doc);
            projecting = true;
            try {
                deps.applyToStore(lastDocScene);
            } finally {
                projecting = false;
            }
            doc.on('update', handleDocUpdate);
            unsubscribeStore = deps.subscribeStore(handleStoreChange);
        },
        stop(): void {
            doc.off('update', handleDocUpdate);
            unsubscribeStore?.();
            unsubscribeStore = null;
            lastDocScene = null;
        },
    };
}
