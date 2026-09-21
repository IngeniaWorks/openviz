import type { NodeLockState } from '@/types';
import type { FlowViewport } from './CursorOverlay';

/** Minimal structural shape of a flow node — positions are world coordinates. */
export interface LockBadgeNode {
    id: string;
    position: { x: number; y: number };
}

export interface NodeLockBadgesProps {
    /** Current React Flow nodes (positions are in world coordinates). */
    nodes: LockBadgeNode[];
    /** Remote soft locks keyed by node id. */
    nodeLocks: Record<string, NodeLockState>;
    /** Current React Flow viewport — used to convert world → screen coordinates. */
    viewport: FlowViewport;
}

/**
 * Pointer-events-free overlay that draws a lock badge at the top-left corner
 * of every node another collaborator currently holds (spec FR-015). The badge
 * is informational — enforcement happens via `selectable/draggable=false` and
 * action guards.
 */
export function NodeLockBadges({ nodes, nodeLocks, viewport }: NodeLockBadgesProps): JSX.Element {
    const byId = new Map(nodes.map((node) => [node.id, node]));

    return (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
            {Object.values(nodeLocks).map((lock) => {
                const node = byId.get(lock.nodeId);
                if (!node) return null;
                const left = node.position.x * viewport.zoom + viewport.x;
                const top = node.position.y * viewport.zoom + viewport.y;
                return (
                    <div
                        key={lock.nodeId}
                        data-lock-node={lock.nodeId}
                        className="absolute -translate-x-1/2 -translate-y-full"
                        style={{ left, top }}
                        title={`${lock.userName ?? lock.userId} is editing this`}
                    >
                        <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-500/95 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-md">
                            🔒 {lock.userName ?? lock.userId}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
