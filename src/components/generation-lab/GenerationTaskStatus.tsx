'use client';

import { AlertTriangle, Lock, RefreshCw, XCircle } from 'lucide-react';
import type { GenerationTaskApi } from './useRenderTask';
import { useAIReadiness } from './useAIReadiness';

const STATUS_BUTTON_CLASS = 'nodrag flex items-center gap-1 rounded-lg border border-viz-border bg-viz-surface px-2 py-1 text-[10px] font-medium text-white transition-colors hover:border-viz-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent';

/**
 * Shared task lifecycle surface for every mode: queue position while queued,
 * cancel while running, error + retry on failure (spec edge case), and the
 * result grid with per-output seed lock (SC-008).
 */
export function GenerationTaskStatus({ task }: { task: GenerationTaskApi }) {
    const readiness = useAIReadiness();

    // T031 (spec edge case): idle with no backend configured → readiness note.
    if (task.status === 'idle' && !readiness.ready) {
        return (
            <p role="note" className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-400/40 bg-amber-950/30 px-2.5 py-2 text-[11px] text-amber-200">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                AI not ready — {readiness.reason ?? 'no image backend configured'}. Configure a backend in Settings; your last request is kept for retry.
            </p>
        );
    }

    if (task.status === 'queued' || task.status === 'active') {
        return (
            <div role="status" aria-live="polite" className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-viz-border bg-viz-panel/60 px-2.5 py-2">
                <span className="text-[11px] text-white/90">
                    {task.status === 'queued' ? `Queued · position ${task.queuePosition ?? '…'}` : 'Generating…'}
                </span>
                <button type="button" onClick={task.cancel} className={STATUS_BUTTON_CLASS}>
                    <XCircle size={12} aria-hidden="true" />Cancel
                </button>
            </div>
        );
    }

    if (task.status === 'failed' && task.error) {
        return (
            <div role="alert" className="mt-2 space-y-1.5 rounded-lg border border-red-400/40 bg-red-950/30 px-2.5 py-2">
                <p className="flex items-start gap-1.5 text-[11px] text-red-200">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                    {task.error}
                </p>
                <button type="button" onClick={task.retry} className={STATUS_BUTTON_CLASS}>
                    <RefreshCw size={12} aria-hidden="true" />Retry
                </button>
            </div>
        );
    }

    if ((task.status === 'completed' || task.status === 'partial') && task.outputs.length > 0) {
        return (
            <div className="mt-2 space-y-1.5">
                {task.status === 'partial' && (
                    <p className="text-[10px] text-amber-300">Some outputs failed; the successful ones are kept.</p>
                )}
                <ul className="grid grid-cols-2 gap-1.5" aria-label="Generation results">
                    {task.outputs.map((output) => (
                        <li key={output.id} className="relative overflow-hidden rounded-lg border border-viz-border bg-viz-panel">
                            {output.url ? (
                                <img src={output.url} alt={`Generated output ${String(output.seed ?? '')}`} className="aspect-square w-full object-cover" />
                            ) : (
                                <span className="flex aspect-square items-center justify-center text-[10px] text-viz-muted">Structured result</span>
                            )}
                            {output.seed !== undefined && (
                                <button
                                    type="button"
                                    onClick={() => task.regenerateWithSeed(output.id)}
                                    aria-label={`Lock seed ${output.seed} and regenerate`}
                                    className="nodrag absolute bottom-1 right-1 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent"
                                >
                                    <Lock size={9} aria-hidden="true" />Seed {output.seed}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    return null;
}
