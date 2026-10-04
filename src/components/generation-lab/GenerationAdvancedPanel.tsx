'use client';

import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import type { AdvancedConfiguration } from './generationNodeMockup.types';

const STEP_OPTIONS = [20, 30, 40, 50];
const RESOLUTION_OPTIONS: Array<AdvancedConfiguration['referenceResolution']> = [512, 1024, 2048];

const FIELD_CLASS = 'nodrag w-full rounded-lg border border-viz-border bg-viz-surface px-2 py-1.5 text-xs text-white outline-none transition-colors focus:border-viz-accent';
const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-wider text-viz-muted';

interface GenerationAdvancedPanelProps {
    value: AdvancedConfiguration;
    onChange: (patch: Partial<AdvancedConfiguration>) => void;
}

/**
 * FR-003: exactly the MVP power-user set — generation quality/steps, prompt
 * adherence and reference resolution — clearly separated from the default
 * task-level UI with safe defaults. Deferred controls (mask, LoRA, control
 * conditioning, upscale) must not appear here.
 */
export function GenerationAdvancedPanel({ value, onChange }: GenerationAdvancedPanelProps) {
    return (
        <div className="mt-2">
            <button
                type="button"
                aria-expanded={value.open}
                onClick={() => onChange({ open: !value.open })}
                className="nodrag flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium text-viz-muted transition-colors hover:bg-viz-surface hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent"
            >
                <SlidersHorizontal size={12} aria-hidden="true" />
                Advanced
                <ChevronDown size={12} className={`transition-transform ${value.open ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {value.open && (
                <div role="region" aria-label="Advanced settings" className="mt-1.5 space-y-2 rounded-lg border border-viz-border bg-viz-panel/60 p-2">
                    <div className="space-y-1">
                        <label htmlFor="advanced-steps" className={LABEL_CLASS}>Generation quality (steps)</label>
                        <select
                            id="advanced-steps"
                            value={String(value.steps)}
                            onChange={(event) => onChange({ steps: Number(event.target.value) })}
                            className={FIELD_CLASS}
                        >
                            {STEP_OPTIONS.map((steps) => (
                                <option key={steps} value={steps}>{steps}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="advanced-guidance" className={LABEL_CLASS}>Prompt adherence</label>
                        <input
                            id="advanced-guidance"
                            type="range"
                            min={1}
                            max={10}
                            step={0.5}
                            value={value.guidance}
                            onChange={(event) => onChange({ guidance: Number(event.target.value) })}
                            className="nodrag w-full accent-viz-accent"
                        />
                        <span className="text-right text-[10px] text-viz-muted">{value.guidance.toFixed(1)}</span>
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="advanced-resolution" className={LABEL_CLASS}>Reference resolution</label>
                        <select
                            id="advanced-resolution"
                            value={String(value.referenceResolution)}
                            onChange={(event) => onChange({ referenceResolution: Number(event.target.value) as AdvancedConfiguration['referenceResolution'] })}
                            className={FIELD_CLASS}
                        >
                            {RESOLUTION_OPTIONS.map((resolution) => (
                                <option key={resolution} value={resolution}>{resolution}px</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
        </div>
    );
}
