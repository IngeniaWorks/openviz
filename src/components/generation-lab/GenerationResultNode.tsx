'use client';

import { Lock } from 'lucide-react';
import { cn, mediaNodeFrameClass, mediaNodeTitleClass } from '@/components/nodes/nodeUi';
import type { RenderTaskOutputState } from '@/store/slices/renderTaskSlice';

const SEED_BUTTON_CLASS = 'nodrag absolute bottom-1 right-1 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent';

/**
 * T032: result outputs as separate mockup nodes on the lab canvas, connected
 * to the generation node. The per-output seed lock (SC-008) is reachable from
 * each node.
 */
export function GenerationResultNode({ outputs, onRegenerateWithSeed }: { outputs: RenderTaskOutputState[]; onRegenerateWithSeed: (outputId: string) => void }) {
    if (outputs.length === 0) return null;
    return (
        <div className="relative z-10 flex w-[256px] flex-col gap-3" aria-label="Generation results">
            {outputs.map((output, index) => (
                <div key={output.id} role="group" aria-label={`Generation result ${index + 1}`}>
                    <span className={mediaNodeTitleClass()}>Output {index + 1} · result</span>
                    <div className={cn(mediaNodeFrameClass(false), 'aspect-square')}>
                        {output.url ? (
                            <img src={output.url} alt={`Generated output ${String(output.seed ?? index + 1)}`} className="h-full w-full object-cover" />
                        ) : (
                            <span className="flex h-full items-center justify-center text-[10px] text-viz-muted">Structured result</span>
                        )}
                        {output.seed !== undefined && (
                            <button type="button" onClick={() => onRegenerateWithSeed(output.id)} aria-label={`Lock seed ${output.seed} and regenerate`} className={SEED_BUTTON_CLASS}>
                                <Lock size={9} aria-hidden="true" />Seed {output.seed}
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
