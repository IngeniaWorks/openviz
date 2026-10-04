import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GenerationInstantRenderMode } from '@/components/generation-lab/GenerationInstantRenderMode';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { GenerationPlaygroundState } from '@/components/generation-lab/generationNodeMockup.types';
import type { RenderTaskRequest, RenderTaskAspectRatio } from '@/types/renderTask.types';

const REFERENCE: RenderTaskReference = { id: 'ref-1', name: 'Arc Lamp', dataUrl: 'data:image/png;base64,aW1nMQ==' };

const INITIAL_STATE: GenerationPlaygroundState = {
    mode: 'instant-render',
    prompt: '',
    instantRatio: '1:1',
    advanced: { open: false, steps: 30, guidance: 4, referenceResolution: 1024 },
    modify: { aspectRatio: '1:1', fidelity: 0.9 },
    animate: { styleId: 'standard_video', duration: '4s' },
    variation: {
        kind: 'form',
        axisLabels: { top: 'Top', bottom: 'Bottom', left: 'Left', right: 'Right' },
        position: 'center',
        preset: 'Balanced',
        magnitude: 0.5,
        paletteName: 'Untitled palette',
        swatches: ['stone', 'moss', 'sea', 'ember'],
        colorCount: 4,
        formCount: 4,
    },
    selectedView: '',
    extractKind: 'color',
    sampleBy: 'Hierarchy',
    extractAttached: false,
};

function makeTaskApi() {
    return {
        status: 'idle' as const,
        queuePosition: null,
        error: null,
        outputs: [] as Array<{ id: string; url?: string; seed?: number }>,
        extraction: null,
        submit: vi.fn(),
        cancel: vi.fn(),
        retry: vi.fn(),
        regenerateWithSeed: vi.fn(),
    };
}

function renderInstantRender(props: { prompt?: string; references?: RenderTaskReference[]; ratio?: RenderTaskAspectRatio } = {}) {
    const onGenerate = vi.fn();
    render(
        <GenerationInstantRenderMode
            state={{ ...INITIAL_STATE, prompt: props.prompt ?? '', instantRatio: props.ratio ?? '1:1' }}
            onUpdate={vi.fn()}
            references={props.references ?? [REFERENCE]}
            task={makeTaskApi()}
            onGenerate={onGenerate}
            onBack={vi.fn()}
        />,
    );
    return { onGenerate };
}

describe('GenerationInstantRenderMode — US2 behavior (T012)', () => {
    it('submits a scene prompt with the connected reference and chosen ratio (US2/AC1, FR-013)', () => {
        const { onGenerate } = renderInstantRender({ prompt: 'the same lamp in a warm living room, three-quarter view', ratio: '16:9' });
        fireEvent.click(screen.getByRole('button', { name: /generate/i }));

        expect(onGenerate).toHaveBeenCalledTimes(1);
        const request = onGenerate.mock.calls[0][0] as RenderTaskRequest;
        expect(request.kind).toBe('instant-render');
        expect(request.prompt).toBe('the same lamp in a warm living room, three-quarter view');
        expect(request.referenceImageId).toBe('ref-1');
        expect(request.aspectRatio).toBe('16:9');
    });

    it('offers all seven documented aspect-ratio presets (FR-013)', () => {
        renderInstantRender({ prompt: 'scene' });
        const select = screen.getByRole('combobox', { name: /aspect ratio/i });
        const options = Array.from(select.querySelectorAll('option')).map((option) => option.value);
        expect(options).toEqual(expect.arrayContaining(['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3']));
    });

    it('shows a connect-an-image state and disables Generate with no reference (US2/AC3)', () => {
        const { onGenerate } = renderInstantRender({ prompt: 'warm living room', references: [] });
        expect(screen.getByText(/connect an image/i)).toBeInTheDocument();
        const generate = screen.getByRole('button', { name: /generate/i });
        expect(generate).toBeDisabled();
        fireEvent.click(generate);
        expect(onGenerate).not.toHaveBeenCalled();
    });

    it('blocks generation with an empty prompt (spec edge case)', () => {
        const { onGenerate } = renderInstantRender({ prompt: '' });
        expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: /generate/i }));
        expect(onGenerate).not.toHaveBeenCalled();
    });
});
