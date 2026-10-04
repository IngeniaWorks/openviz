export type GenerationMode = 'base' | 'modify' | 'animate' | 'instant-render' | 'variation' | 'new-view' | 'extract';

export interface ModifyConfiguration {
    aspectRatio: string;
    /** 0–1; lower = closer to the source image (FR-012). */
    fidelity: number;
}

/** FR-003 MVP advanced set only. Mask/LoRA/control conditioning/upscale are deferred. */
export interface AdvancedConfiguration {
    open: boolean;
    /** Generation quality / inference steps. */
    steps: number;
    /** Prompt adherence (guidance). */
    guidance: number;
    referenceResolution: 512 | 1024 | 2048;
}

export interface AnimateConfiguration {
    styleId: string;
    duration: import('@/types/renderTask.types').RenderTaskDuration;
}
export type VariationKind = 'form' | 'color';
export type ExtractKind = 'color' | 'material' | 'parts';
export type VariationCount = 2 | 4 | 8;
export type VariationPreset = 'Balanced' | 'Soft sculpt' | 'Geometric' | 'Organic';
export type FormPosition = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';
export type VariationAxis = 'top' | 'bottom' | 'left' | 'right';
export type ExtractSampleBy = 'Hierarchy' | 'Region';

export interface VariationConfiguration {
    kind: VariationKind;
    axisLabels: Record<VariationAxis, string>;
    position: FormPosition;
    preset: VariationPreset;
    /** 0–1 form-morph magnitude (FR-015). */
    magnitude: number;
    paletteName: string;
    swatches: string[];
    colorCount: VariationCount;
    formCount: VariationCount;
}

export interface GenerationPlaygroundState {
    mode: GenerationMode;
    prompt: string;
    /** Instant Render output ratio (FR-013). */
    instantRatio: import('@/types/renderTask.types').RenderTaskAspectRatio;
    advanced: AdvancedConfiguration;
    modify: ModifyConfiguration;
    animate: AnimateConfiguration;
    variation: VariationConfiguration;
    selectedView: string;
    extractKind: ExtractKind;
    sampleBy: ExtractSampleBy;
    extractAttached: boolean;
}

export type GenerationStatePatch = Partial<GenerationPlaygroundState>;
export type VariationPatch = Partial<VariationConfiguration>;
