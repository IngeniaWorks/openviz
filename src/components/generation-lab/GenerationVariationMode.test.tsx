import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GenerationVariationMode } from '@/components/generation-lab/GenerationVariationMode';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { GenerationPlaygroundState } from '@/components/generation-lab/generationNodeMockup.types';
import type { RenderTaskRequest } from '@/types/renderTask.types';

const REFERENCE: RenderTaskReference = { id: 'ref-1', name: 'Arc Lamp', dataUrl: 'data:image/png;base64,aW1nMQ==' };

const INITIAL_STATE: GenerationPlaygroundState = {
    mode: 'variation',
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

function renderVariation(props: { references?: RenderTaskReference[] } = {}) {
    const onGenerate = vi.fn();
    render(
        <GenerationVariationMode
            state={INITIAL_STATE}
            onUpdate={vi.fn()}
            references={props.references ?? [REFERENCE]}
            task={makeTaskApi()}
            onGenerate={onGenerate}
            onBack={vi.fn()}
        />,
    );
    return { onGenerate };
}

/** Stateful harness for interacting with the form controls. */
function Harness({ onGenerate }: { onGenerate: (request: RenderTaskRequest) => void }) {
    const [state, setState] = useState(INITIAL_STATE);
    return (
        <GenerationVariationMode
            state={state}
            onUpdate={(patch) => setState((current) => ({ ...current, ...patch }))}
            references={[REFERENCE]}
            task={makeTaskApi()}
            onGenerate={onGenerate}
            onBack={vi.fn()}
        />
    );
}

describe('GenerationVariationMode — US3 behavior (T014)', () => {
    it('submits a form batch with preset, magnitude and count (US3/AC1)', () => {
        const { onGenerate } = renderVariation();
        fireEvent.click(screen.getByRole('button', { name: /generate 4 variations/i }));

        expect(onGenerate).toHaveBeenCalledTimes(1);
        const request = onGenerate.mock.calls[0][0] as RenderTaskRequest;
        expect(request.kind).toBe('form-variate');
        expect(request.referenceImageId).toBe('ref-1');
        expect(request.variationCount).toBe(4);
        expect(request.formDirection?.preset).toBe('balanced');
        expect(request.formDirection?.magnitude).toBe(0.5);
    });

    it('submits a color batch with hex palette swatches and colorway count (US3/AC2, FR-008)', () => {
        const onGenerate = vi.fn();
        render(
            <GenerationVariationMode
                state={{ ...INITIAL_STATE, variation: { ...INITIAL_STATE.variation, kind: 'color' } }}
                onUpdate={vi.fn()}
                references={[REFERENCE]}
                task={makeTaskApi()}
                onGenerate={onGenerate}
                onBack={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /generate 4 variations/i }));

        const request = onGenerate.mock.calls[0][0] as RenderTaskRequest;
        expect(request.kind).toBe('color-variate');
        expect(request.variationCount).toBe(4);
        expect(request.palette?.swatches).toHaveLength(4);
        for (const swatch of request.palette?.swatches ?? []) {
            expect(swatch).toMatch(/^#[0-9a-f]{6}$/i);
        }
    });

    it('maps the magnitude slider monotonically into formDirection.magnitude (US3/AC4, FR-015)', () => {
        const onGenerate = vi.fn();
        render(<Harness onGenerate={onGenerate} />);

        const slider = screen.getByRole('slider', { name: /form magnitude/i }) as HTMLInputElement;
        expect(Number(slider.value)).toBe(50);

        fireEvent.change(slider, { target: { value: '100' } });
        fireEvent.click(screen.getByRole('button', { name: /generate 4 variations/i }));
        expect((onGenerate.mock.calls[0][0] as RenderTaskRequest).formDirection?.magnitude).toBe(1);

        fireEvent.change(slider, { target: { value: '0' } });
        fireEvent.click(screen.getByRole('button', { name: /generate 4 variations/i }));
        expect((onGenerate.mock.calls[1][0] as RenderTaskRequest).formDirection?.magnitude).toBe(0);
    });

    it('disables Generate and shows a connect-an-image state without a reference (spec edge case)', () => {
        const { onGenerate } = renderVariation({ references: [] });
        expect(screen.getByText(/connect an image/i)).toBeInTheDocument();
        const generate = screen.getByRole('button', { name: /generate/i });
        expect(generate).toBeDisabled();
        fireEvent.click(generate);
        expect(onGenerate).not.toHaveBeenCalled();
    });
});
