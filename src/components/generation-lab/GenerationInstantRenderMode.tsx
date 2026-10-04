'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { WandSparkles } from 'lucide-react';
import { nodeCardBodyClass } from '@/components/nodes/nodeUi';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { GenerationPlaygroundState, GenerationStatePatch } from './generationNodeMockup.types';
import type { RenderTaskAspectRatio, RenderTaskRequest } from '@/types/renderTask.types';
import type { GenerationTaskApi } from './useRenderTask';
import { ModeHeader, NODE_BUTTON_CLASS, PromptEditor, SectionLabel } from './GenerationModeControls';
import { GenerationAdvancedPanel } from './GenerationAdvancedPanel';
import { GenerationTaskStatus } from './GenerationTaskStatus';

interface GenerationInstantRenderModeProps {
    state: GenerationPlaygroundState;
    onUpdate: (patch: GenerationStatePatch) => void;
    references: RenderTaskReference[];
    task: GenerationTaskApi;
    onGenerate: (request: RenderTaskRequest) => void;
    onBack: () => void;
}

const RATIO_OPTIONS: RenderTaskAspectRatio[] = ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'];

export function GenerationInstantRenderMode({ state, onUpdate, references, task, onGenerate, onBack }: GenerationInstantRenderModeProps) {
    const reduceMotion = useReducedMotion();
    const hasPrompt = state.prompt.trim().length > 0;
    const hasReference = references.length > 0;
    const canGenerate = hasPrompt && hasReference && (task.status === 'idle' || task.status === 'completed' || task.status === 'partial' || task.status === 'failed');

    const generate = () => {
        if (!canGenerate) return;
        onGenerate({
            kind: 'instant-render',
            prompt: state.prompt.trim(),
            referenceImageId: references[0]?.id,
            aspectRatio: state.instantRatio,
            advanced: { steps: state.advanced.steps, guidance: state.advanced.guidance, referenceResolution: state.advanced.referenceResolution },
        });
    };

    return (
        <>
            <ModeHeader mode="instant-render" title="Instant Render" icon={WandSparkles} onBack={onBack} />
            <div className={nodeCardBodyClass()}>
                <div className="space-y-1.5">
                    <SectionLabel>Reference image</SectionLabel>
                    {hasReference ? (
                        <div className="flex items-center gap-2 rounded-lg border border-viz-border bg-viz-surface p-1.5">
                            <img src={references[0]?.dataUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                            <span className="min-w-0 flex-1 truncate text-xs text-white/90">{references[0]?.name}</span>
                            <span className="shrink-0 rounded bg-viz-panel px-1.5 py-1 text-[9px] text-viz-muted">1 ref</span>
                        </div>
                    ) : (
                        <p role="note" className="rounded-lg border border-dashed border-viz-border bg-viz-panel px-2.5 py-2 text-[10px] text-viz-muted">Connect an image before generating.</p>
                    )}
                </div>

                <PromptEditor id="instant-render-prompt" autoFocus value={state.prompt} onChange={(prompt) => onUpdate({ prompt })} />

                <div className="mt-2 space-y-1">
                    <label htmlFor="instant-ratio" className="text-[10px] font-bold uppercase tracking-wider text-viz-muted">Aspect ratio</label>
                    <select
                        id="instant-ratio"
                        value={state.instantRatio}
                        onChange={(event) => onUpdate({ instantRatio: event.target.value as RenderTaskAspectRatio })}
                        className="nodrag w-full rounded-lg border border-viz-border bg-viz-surface px-2 py-1.5 text-xs text-white outline-none transition-colors focus:border-viz-accent"
                    >
                        {RATIO_OPTIONS.map((ratio) => (
                            <option key={ratio} value={ratio}>{ratio}</option>
                        ))}
                    </select>
                </div>

                {!hasPrompt && (
                    <p role="note" className="mt-2 text-center text-[10px] text-viz-muted">A description is required to generate.</p>
                )}

                <motion.button
                    type="button"
                    disabled={!canGenerate}
                    onClick={generate}
                    initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 28, delay: 0.04 }}
                    className={`${NODE_BUTTON_CLASS} mt-2 flex w-full items-center justify-center gap-1.5`}
                >
                    <WandSparkles size={14} aria-hidden="true" />Generate
                </motion.button>

                <GenerationAdvancedPanel value={state.advanced} onChange={(patch) => onUpdate({ advanced: { ...state.advanced, ...patch } })} />
                <GenerationTaskStatus task={task} />
            </div>
        </>
    );
}
