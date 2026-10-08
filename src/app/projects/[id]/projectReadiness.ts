export interface CachePaintState {
    /** Last project whose nodes are persisted in workbenchNodes (never cleared on unmount). */
    lastOpenedProjectId: string | null;
    /** True once the store finished rehydrating from IndexedDB. */
    persistHydrated: boolean;
    /** Persisted workbenchNodes.length — the helper only cares about emptiness. */
    workbenchNodeCount: number;
    collabSessionActive: boolean;
}

/**
 * Stale-while-revalidate: if the persisted store already holds this project's
 * nodes, paint immediately instead of waiting for /api/projects/:id.
 *
 * Refuses to paint from cache when a collaboration session owns the scene —
 * the live shared document is the source of truth and the cached snapshot
 * would flash stale content (same guard as the persist merge in useStore.ts).
 */
export function shouldPaintFromCache(state: CachePaintState, projectId: string): boolean {
    if (!state.persistHydrated) return false;
    if (state.collabSessionActive) return false;
    // workbenchNodes is a single global array — it only belongs to this
    // project when the persisted lastOpenedProjectId matches.
    if (state.lastOpenedProjectId !== projectId) return false;
    return state.workbenchNodeCount > 0;
}

export interface ReconcileState {
    /** We painted from cache before the server response arrived. */
    paintedFromCache: boolean;
    collabOwnsScene: boolean;
    localVersion: number | null;
    serverVersion: number | null;
}

/**
 * Decide whether the arriving server scene replaces store contents:
 * - collab owns the scene → never hydrate from the DB snapshot.
 * - fresh load (no cache paint) → always hydrate.
 * - cache paint → hydrate unless the local version is strictly newer
 *   (unsaved/pending work must not be clobbered or downgraded).
 */
export function shouldHydrateFromServer(state: ReconcileState): boolean {
    if (state.collabOwnsScene) return false;
    if (!state.paintedFromCache) return true;
    const { localVersion, serverVersion } = state;
    if (localVersion === null || serverVersion === null) return true;
    return serverVersion >= localVersion;
}
