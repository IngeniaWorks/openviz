import { useRef } from 'react';
import { ArrowDownRight, ChevronDown, CopyPlus, Plus, RotateCcw } from 'lucide-react';
import { nodeCardBodyClass } from '@/components/nodes/nodeUi';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { FormDirection, PaletteAssetPayload, ProjectAsset, RenderTaskRequest } from '@/types/renderTask.types';
import type { FormPosition, GenerationPlaygroundState, GenerationStatePatch, VariationAxis, VariationCount, VariationPreset } from './generationNodeMockup.types';
import type { GenerationTaskApi } from './useRenderTask';
import { ModeHeader, NODE_BUTTON_CLASS, NODE_CONTROL_CLASS, SectionLabel } from './GenerationModeControls';
import { GenerationAdvancedPanel } from './GenerationAdvancedPanel';
import { GenerationTaskStatus } from './GenerationTaskStatus';
import { useExtractionAssets } from './useExtractionAssets';
import { SavedPalettePicker, type SavedPalette } from './SavedPalettePicker';

interface GenerationVariationModeProps {
    state: GenerationPlaygroundState;
    onUpdate: (patch: GenerationStatePatch) => void;
    references: RenderTaskReference[];
    task: GenerationTaskApi;
    onGenerate: (request: RenderTaskRequest) => void;
    onBack: () => void;
}

const COUNTS: VariationCount[] = [2, 4, 8];
const PRESETS: VariationPreset[] = ['Balanced', 'Soft sculpt', 'Geometric', 'Organic'];

/** UI preset label → resolver direction preset (FR-015 documented phrasings). */
const PRESET_TO_DIRECTION: Record<VariationPreset, FormDirection['preset']> = {
    Balanced: 'balanced',
    'Soft sculpt': 'soft-sculpt',
    Geometric: 'geometric',
    Organic: 'organic',
};

/** Named swatch → hex for the palette contract (FR-008). */
const SWATCH_HEX: Record<string, string> = {
    stone: '#a1a1aa',
    moss: '#047857',
    sea: '#0369a1',
    ember: '#c2410c',
    sand: '#fde68a',
};
const SWATCH_CYCLE = ['stone', 'moss', 'sea', 'ember', 'sand'];

/** Named swatch or raw hex (saved palettes, T030) → request hex. */
function swatchToHex(swatch: string): string {
    const named = SWATCH_HEX[swatch];
    if (named) return named;
    return /^#[0-9a-f]{6}$/i.test(swatch) ? swatch : '#808080';
}

function toSavedPalette(asset: ProjectAsset): SavedPalette | null {
    if (asset.kind !== 'palette') return null;
    const payload = asset.payload as PaletteAssetPayload;
    return { id: asset.id, name: payload.name, swatches: payload.swatches };
}
const SWATCH_CLASSES: Record<string, string> = {
    stone: 'bg-zinc-400',
    moss: 'bg-emerald-700',
    sea: 'bg-sky-700',
    ember: 'bg-orange-700',
    sand: 'bg-amber-200',
};
const POSITION_CLASS: Record<FormPosition, string> = {
    'top-left': 'left-[25%] top-[25%]',
    top: 'left-1/2 top-[25%]',
    'top-right': 'left-[75%] top-[25%]',
    left: 'left-[25%] top-1/2',
    center: 'left-1/2 top-1/2',
    right: 'left-[75%] top-1/2',
    'bottom-left': 'left-[25%] top-[75%]',
    bottom: 'left-1/2 top-[75%]',
    'bottom-right': 'left-[75%] top-[75%]',
};
const POSITIONS: FormPosition[] = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
const AXIS_INPUT_CLASS = 'nodrag absolute z-10 w-[4.5rem] rounded border border-viz-border bg-viz-panel/90 px-1 py-0.5 text-center text-[9px] text-white outline-none focus:border-viz-accent';

export function GenerationVariationMode({ state, onUpdate, references, task, onGenerate, onBack }: GenerationVariationModeProps) {
    const config = state.variation;
    const count = config.kind === 'form' ? config.formCount : config.colorCount;
    const hasReference = references.length > 0;
    const canGenerate = hasReference && (task.status === 'idle' || task.status === 'completed' || task.status === 'partial' || task.status === 'failed');
    // T030 (FR-023): saved palettes are only needed by the color sub-mode.
    const { assets } = useExtractionAssets({ enabled: config.kind === 'color' });
    const savedPalettes = assets.map(toSavedPalette).filter((palette): palette is SavedPalette => palette !== null);

    const generate = () => {
        if (!canGenerate) return;
        const base = {
            referenceImageId: references[0]?.id,
            variationCount: count,
            advanced: { steps: state.advanced.steps, guidance: state.advanced.guidance, referenceResolution: state.advanced.referenceResolution },
        };
        if (config.kind === 'form') {
            onGenerate({
                ...base,
                kind: 'form-variate',
                formDirection: { preset: PRESET_TO_DIRECTION[config.preset], magnitude: config.magnitude, axisLabels: config.axisLabels },
            });
        } else {
            onGenerate({
                ...base,
                kind: 'color-variate',
                palette: { name: config.paletteName || undefined, swatches: config.swatches.map(swatchToHex) },
            });
        }
    };

    return (
        <>
            <ModeHeader mode="variation" title="Variation" icon={CopyPlus} onBack={onBack} />
            <div className={nodeCardBodyClass()}>
                {!hasReference && (
                    <p role="note" className="rounded-lg border border-dashed border-viz-border bg-viz-panel px-2.5 py-2 text-[10px] text-viz-muted">Connect an image before exploring variations.</p>
                )}
                <div className="grid grid-cols-2 rounded-lg border border-viz-border bg-viz-bg p-0.5" role="group" aria-label="Variation type">
                    {(['form', 'color'] as const).map((kind) => (
                        <button key={kind} type="button" aria-label={kind === 'form' ? 'Form' : 'Color'} aria-pressed={config.kind === kind} onClick={() => onUpdate({ variation: { ...config, kind } })} className={`nodrag h-7 rounded-md text-xs capitalize transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent ${config.kind === kind ? 'bg-viz-selected text-white' : 'text-viz-muted hover:bg-viz-surface hover:text-white'}`}>
                            {kind}
                        </button>
                    ))}
                </div>
                {config.kind === 'form'
                    ? <FormVariation config={config} onUpdate={(variation) => onUpdate({ variation })} />
                    : <ColorVariation config={config} savedPalettes={savedPalettes} onSelectPalette={(palette) => onUpdate({ variation: { ...config, swatches: [...palette.swatches], paletteName: palette.name ?? 'Saved palette' } })} onUpdate={(variation) => onUpdate({ variation })} />}
                <button type="button" disabled={!canGenerate} onClick={generate} className={`${NODE_BUTTON_CLASS} w-full`}>
                    Generate {count} variations
                </button>
                <GenerationAdvancedPanel value={state.advanced} onChange={(patch) => onUpdate({ advanced: { ...state.advanced, ...patch } })} />
                <GenerationTaskStatus task={task} />
            </div>
        </>
    );
}

function FormVariation({ config, onUpdate }: { config: GenerationPlaygroundState['variation']; onUpdate: (config: GenerationPlaygroundState['variation']) => void }) {
    const gridRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef(false);
    const setPositionFromPointer = (clientX: number, clientY: number) => {
        const bounds = gridRef.current?.getBoundingClientRect();
        if (!bounds || bounds.width === 0 || bounds.height === 0) return;
        const column = Math.min(2, Math.max(0, Math.floor(((clientX - bounds.left) / bounds.width) * 3)));
        const row = Math.min(2, Math.max(0, Math.floor(((clientY - bounds.top) / bounds.height) * 3)));
        onUpdate({ ...config, position: POSITIONS[row * 3 + column] });
    };
    const movePosition = (key: string) => {
        const currentIndex = POSITIONS.indexOf(config.position);
        const row = Math.floor(currentIndex / 3);
        const column = currentIndex % 3;
        const nextRow = Math.min(2, Math.max(0, row + (key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0)));
        const nextColumn = Math.min(2, Math.max(0, column + (key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0)));
        onUpdate({ ...config, position: POSITIONS[nextRow * 3 + nextColumn] });
    };

    return (
        <div className="space-y-2">
            <SectionLabel>Form morph</SectionLabel>
            <div ref={gridRef} className="relative aspect-square overflow-hidden rounded-lg border border-viz-border bg-viz-surface/20" role="group" aria-label="2 by 2 form morph grid" onPointerMove={(event) => { if (dragRef.current) setPositionFromPointer(event.clientX, event.clientY); }} onPointerUp={() => { dragRef.current = false; }} onPointerCancel={() => { dragRef.current = false; }}>
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2" aria-hidden="true">
                    <div className="border-b border-r border-dashed border-viz-border bg-viz-surface/20" />
                    <div className="border-b border-dashed border-viz-border bg-viz-surface/10" />
                    <div className="border-r border-dashed border-viz-border bg-viz-surface/10" />
                    <div className="bg-viz-surface/20" />
                </div>
                <AxisInput axis="top" value={config.axisLabels.top} onChange={(value) => onUpdate({ ...config, axisLabels: { ...config.axisLabels, top: value } })} className="left-1/2 top-1.5 -translate-x-1/2" />
                <AxisInput axis="bottom" value={config.axisLabels.bottom} onChange={(value) => onUpdate({ ...config, axisLabels: { ...config.axisLabels, bottom: value } })} className="bottom-1.5 left-1/2 -translate-x-1/2" />
                <AxisInput axis="left" value={config.axisLabels.left} onChange={(value) => onUpdate({ ...config, axisLabels: { ...config.axisLabels, left: value } })} className="left-1 top-1/2 -translate-y-1/2" />
                <AxisInput axis="right" value={config.axisLabels.right} onChange={(value) => onUpdate({ ...config, axisLabels: { ...config.axisLabels, right: value } })} className="right-1 top-1/2 -translate-y-1/2" />
                <button
                    type="button"
                    role="slider"
                    aria-label="Variation position"
                    aria-valuemin={0}
                    aria-valuemax={8}
                    aria-valuenow={POSITIONS.indexOf(config.position)}
                    aria-valuetext={config.position}
                    onPointerDown={(event) => {
                        dragRef.current = true;
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setPositionFromPointer(event.clientX, event.clientY);
                    }}
                    onKeyDown={(event) => {
                        if (event.key.startsWith('Arrow')) {
                            event.preventDefault();
                            movePosition(event.key);
                        }
                    }}
                    className={`nodrag absolute z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-viz-bg bg-viz-accent text-white shadow-viz focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viz-accent ${POSITION_CLASS[config.position]}`}
                >
                    <ArrowDownRight size={13} aria-hidden="true" />
                </button>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                <label htmlFor="variation-preset" className="text-[10px] font-bold uppercase tracking-wider text-viz-muted">Preset</label>
                <div className="relative">
                    <select id="variation-preset" value={config.preset} onChange={(event) => onUpdate({ ...config, preset: event.target.value as VariationPreset })} className={`${NODE_CONTROL_CLASS} min-w-[128px] appearance-none pr-7`}>
                        {PRESETS.map((preset) => <option key={preset}>{preset}</option>)}
                    </select>
                    <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-viz-muted" aria-hidden="true" />
                </div>
            </div>
            <CountSelector id="form-count" label="Outputs" value={config.formCount} onChange={(formCount) => onUpdate({ ...config, formCount })} />
            <div className="space-y-1">
                <label htmlFor="form-magnitude" className="text-[10px] font-bold uppercase tracking-wider text-viz-muted">Form magnitude</label>
                <div className="flex items-center gap-2">
                    <input
                        id="form-magnitude"
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={Math.round(config.magnitude * 100)}
                        onChange={(event) => onUpdate({ ...config, magnitude: Number(event.target.value) / 100 })}
                        className="nodrag w-full accent-viz-accent"
                    />
                    <span className="w-8 text-right text-[10px] text-viz-muted">{Math.round(config.magnitude * 100)}%</span>
                </div>
            </div>
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[10px] text-viz-muted">Position: {config.position}</span>
                <button type="button" onClick={() => onUpdate({ ...config, position: 'center' })} className="nodrag flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[10px] text-viz-muted hover:bg-viz-surface hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent">
                    <RotateCcw size={11} aria-hidden="true" />Reset to center
                </button>
            </div>
        </div>
    );
}

function AxisInput({ axis, value, onChange, className }: { axis: VariationAxis; value: string; onChange: (value: string) => void; className: string }) {
    return <input aria-label={`${axis} axis label`} value={value} onChange={(event) => onChange(event.target.value)} className={`${AXIS_INPUT_CLASS} ${className}`} />;
}

function ColorVariation({ config, savedPalettes, onSelectPalette, onUpdate }: { config: GenerationPlaygroundState['variation']; savedPalettes: SavedPalette[]; onSelectPalette: (palette: SavedPalette) => void; onUpdate: (config: GenerationPlaygroundState['variation']) => void }) {
    const addSwatch = () => {
        const next = SWATCH_CYCLE.find((swatch) => !config.swatches.includes(swatch)) ?? SWATCH_CYCLE[config.swatches.length % SWATCH_CYCLE.length];
        onUpdate({ ...config, swatches: [...config.swatches, next] });
    };
    return (
        <div className="space-y-2">
            <SectionLabel>Color palette</SectionLabel>
            <div className="flex items-center gap-1.5" role="group" aria-label="Palette swatches">
                {config.swatches.map((swatch, index) => {
                    const namedClass = SWATCH_HEX[swatch] ? (SWATCH_CLASSES[swatch] ?? 'bg-viz-surface') : undefined;
                    return <span key={`${swatch}-${index}`} role="img" aria-label={`${swatch} swatch`} className={`h-8 min-w-0 flex-1 rounded-md border border-viz-border ${namedClass ?? ''}`.trim()} style={namedClass ? undefined : { backgroundColor: swatchToHex(swatch) }} />;
                })}
                <button type="button" aria-label="Add swatch" onClick={addSwatch} className="nodrag flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-viz-border text-viz-muted hover:border-viz-accent hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent"><Plus size={14} aria-hidden="true" /></button>
            </div>
            <label htmlFor="palette-name" className="block space-y-1 text-[10px] font-bold uppercase tracking-wider text-viz-muted">Palette name
                <input id="palette-name" value={config.paletteName} onChange={(event) => onUpdate({ ...config, paletteName: event.target.value })} className={NODE_CONTROL_CLASS} />
            </label>
            <CountSelector id="color-count" label="Colorways" value={config.colorCount} onChange={(colorCount) => onUpdate({ ...config, colorCount })} />
            <div className="space-y-1">
                <SectionLabel>Saved palettes</SectionLabel>
                <SavedPalettePicker palettes={savedPalettes} onSelect={onSelectPalette} />
            </div>
        </div>
    );
}

function CountSelector({ id, label, value, onChange }: { id: string; label: string; value: VariationCount; onChange: (value: VariationCount) => void }) {
    return (
        <label htmlFor={id} className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-viz-muted">{label}
            <select id={id} value={value} onChange={(event) => onChange(Number(event.target.value) as VariationCount)} className="nodrag h-8 rounded-lg border border-viz-border bg-viz-surface px-2 text-xs font-normal normal-case tracking-normal text-white outline-none focus:border-viz-accent">
                {COUNTS.map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
        </label>
    );
}
