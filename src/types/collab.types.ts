/**
 * Collaboration domain types (shared by client services and the standalone
 * Hocuspocus server — keep this module dependency-free).
 */

/** Opaque JSON value used for scene document payloads. */
export type SceneJsonValue = string | number | boolean | null | SceneJsonValue[] | { [key: string]: SceneJsonValue };

export interface SceneNodeJson extends Record<string, SceneJsonValue> {
    id: string;
}

/** Connection entry in the shared document. The persisted scene format uses
 * `from`/`to`; both key pairs are accepted so any variant prunes correctly. */
export interface SceneConnectionJson {
    id: string;
    from?: string;
    to?: string;
    source?: string;
    target?: string;
    [key: string]: SceneJsonValue | undefined;
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

/** Response of POST /api/projects/:id/scenes/collab-token (contracts/room-token-api.md). */
export interface CollabTokenResponse {
    token: string;
    sceneId: string;
    projectId: string;
    expiresAt: number;
}
