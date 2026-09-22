import type { CollabSessionStatus } from '@/types/collab.types';

export interface CollabStatusChipProps {
    status: CollabSessionStatus;
}

const CHIP_COPY: Record<Exclude<CollabSessionStatus, 'idle'>, { label: string; dot: string }> = {
    connected: { label: 'Live', dot: 'bg-emerald-500' },
    'offline-queued': { label: 'Offline — changes queued', dot: 'bg-amber-500' },
    connecting: { label: 'Connecting…', dot: 'bg-slate-400' },
    failed: { label: 'Connection failed', dot: 'bg-red-500' },
    denied: { label: 'Access denied', dot: 'bg-red-500' },
};

/**
 * Connection-state chip for an active collaboration session (US3 / SC-004).
 * While offline the chip says edits are QUEUED — it never claims a durable
 * save, because queued edits only become shared after the next sync.
 */
export function CollabStatusChip({ status }: CollabStatusChipProps): JSX.Element | null {
    if (status === 'idle') return null;

    const { label, dot } = CHIP_COPY[status];
    return (
        <div
            role="status"
            className="flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm ring-1 ring-black/5"
        >
            <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
            {label}
        </div>
    );
}
