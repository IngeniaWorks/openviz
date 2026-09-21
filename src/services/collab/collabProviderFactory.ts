import * as Y from 'yjs';
import HocuspocusProvider, { type HocuspocusProviderConfiguration } from '@hocuspocus/provider';
import type { CollabPresenceState } from '@/types/collab.types';
import { createSceneDoc } from './sceneDocMapping';

/** Per-user transaction origin: `user:<userId>` (server parses it for `updatedBy`). */
export function collabOriginFor(userId: string): string {
    return `user:${userId}`;
}

export interface CollabSessionConfig {
    /** Collaboration server WebSocket URL, e.g. ws://localhost:1234 (env-driven). */
    url: string;
    /** Signed room token from the collab-token API. */
    token: string;
    /** Room name — the project's main scene ID. */
    sceneId: string;
    userId: string;
    userName: string;
}

export interface CollabProviderHandle {
    provider: HocuspocusProvider;
    doc: Y.Doc;
    origin: string;
    destroy(): void;
}

export interface CreateCollabProviderOptions {
    /** Injectable provider class for tests (no network). */
    ProviderClass?: typeof HocuspocusProvider;
}

/**
 * Creates the client-side collaboration stack: shared scene document,
 * Hocuspocus provider bound to the scene room, and the local awareness state.
 */
export function createCollabProvider(
    config: CollabSessionConfig,
    options: CreateCollabProviderOptions = {},
): CollabProviderHandle {
    const ProviderClass = options.ProviderClass ?? HocuspocusProvider;
    const doc = createSceneDoc();
    const origin = collabOriginFor(config.userId);

    const providerConfiguration: HocuspocusProviderConfiguration = {
        url: config.url,
        token: config.token,
        name: config.sceneId,
        document: doc,
    };
    const provider = new ProviderClass(providerConfiguration);

    // Announce ourselves on the awareness channel (presence + cursor host).
    const presence: CollabPresenceState = {
        user: { id: config.userId, name: config.userName },
        cursor: null,
    };
    provider.setAwarenessField('user', presence.user);
    provider.setAwarenessField('cursor', presence.cursor);

    return {
        provider,
        doc,
        origin,
        destroy: () => {
            provider.destroy();
        },
    };
}

/** Runs a local mutation as a single transaction tagged with this user's origin. */
export function applyLocalTransaction(handle: CollabProviderHandle, fn: () => void): void {
    handle.doc.transact(fn, handle.origin);
}

export interface RemoteAwarenessEntry {
    clientId: number;
    state: Record<string, unknown>;
}

/** Awareness states of everyone except the local client. */
export function getRemoteAwarenessStates(provider: HocuspocusProvider): RemoteAwarenessEntry[] {
    const localClientId = provider.awareness.clientID;
    const entries: RemoteAwarenessEntry[] = [];
    for (const [clientId, state] of provider.awareness.getStates()) {
        if (clientId === localClientId) continue;
        entries.push({ clientId, state });
    }
    return entries;
}
