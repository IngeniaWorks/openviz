import * as Y from 'yjs';
import type { SceneConnectionJson, SceneDataJson, SceneJsonValue, SceneNodeJson } from '@/types/collab.types';

/** Recursively converts a Yjs value (deep Y.Map/Y.Array structures) to plain JSON. */
export function yValueToJson(value: unknown): SceneJsonValue {
    if (value instanceof Y.Map) {
        const out: Record<string, SceneJsonValue> = {};
        for (const [key, child] of value.entries()) {
            out[key] = yValueToJson(child);
        }
        return out;
    }
    if (value instanceof Y.Array) {
        return Array.from(value, (child) => yValueToJson(child));
    }
    if (value instanceof Y.Text) {
        return value.toString();
    }
    if (value === null || typeof value !== 'object') {
        return value as SceneJsonValue;
    }
    return value as SceneJsonValue;
}

export const SCENE_NODES_MAP = 'nodes';
export const SCENE_CONNECTIONS_MAP = 'connections';
const SEED_ORIGIN = 'collab-seed';

/** Creates a shared document with the scene's keyed collections. */
export function createSceneDoc(): Y.Doc {
    return new Y.Doc();
}

export function getNodesMap(doc: Y.Doc): Y.Map<unknown> {
    return doc.getMap(SCENE_NODES_MAP);
}

export function getConnectionsMap(doc: Y.Doc): Y.Map<unknown> {
    return doc.getMap(SCENE_CONNECTIONS_MAP);
}

/**
 * Seeds a shared document from saved scene JSON (lazy import on first
 * collaborative open). Replaces any previous content.
 */
export function seedSceneFromJson(doc: Y.Doc, data: SceneDataJson): void {
    const nodes = getNodesMap(doc);
    const connections = getConnectionsMap(doc);
    doc.transact(() => {
        for (const key of Array.from(nodes.keys())) {
            nodes.delete(key);
        }
        for (const key of Array.from(connections.keys())) {
            connections.delete(key);
        }
        for (const node of data.nodes) {
            nodes.set(node.id, node);
        }
        for (const connection of data.connections) {
            connections.set(connection.id, connection);
        }
    }, SEED_ORIGIN);
}

/**
 * Projects the shared document into plain scene JSON. Connections whose
 * endpoints no longer exist are pruned so stale references never reach the
 * canvas or the persisted snapshot.
 */
export function extractSceneFromDoc(doc: Y.Doc): SceneDataJson {
    const nodeIds = new Set<string>();
    const nodes: SceneNodeJson[] = [];
    for (const [id, value] of getNodesMap(doc).entries()) {
        const json = yValueToJson(value) as SceneNodeJson;
        if (typeof json?.id !== 'string') continue;
        nodeIds.add(json.id);
        nodes.push(json);
    }

    const connections: SceneConnectionJson[] = [];
    for (const [id, value] of getConnectionsMap(doc).entries()) {
        const json = yValueToJson(value) as SceneConnectionJson;
        if (typeof json?.id !== 'string' || typeof json.source !== 'string' || typeof json.target !== 'string') {
            continue;
        }
        if (!nodeIds.has(json.source) || !nodeIds.has(json.target)) continue;
        connections.push(json);
    }

    return { nodes, connections };
}
