/**
 * Collaboration domain types (shared by client services and the standalone
 * Hocuspocus server — keep this module dependency-free).
 */

/** Opaque JSON value used for scene document payloads. */
export type SceneJsonValue = string | number | boolean | null | SceneJsonValue[] | { [key: string]: SceneJsonValue };

export interface SceneNodeJson extends Record<string, SceneJsonValue> {
    id: string;
}

export interface SceneConnectionJson extends Record<string, SceneJsonValue> {
    id: string;
    source: string;
    target: string;
}

/** Shape of `scenes.data` — the saved workbench graph. */
export interface SceneDataJson {
    nodes: SceneNodeJson[];
    connections: SceneConnectionJson[];
}

/** Awareness payload published by each client (contracts/presence-awareness.md). */
export interface CollabPresenceState {
    user: { id: string; name: string };
    cursor: { x: number; y: number } | null;
}

/** Session lifecycle states surfaced to the workbench UI. */
export type CollabSessionStatus = 'idle' | 'connecting' | 'connected' | 'offline-queued' | 'denied';
