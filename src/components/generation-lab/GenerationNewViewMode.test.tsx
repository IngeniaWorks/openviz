import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GenerationNewViewMode } from '@/components/generation-lab/GenerationNewViewMode';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { GenerationPlaygroundState } from '@/components/generation-lab/generationNodeMockup.types';
import type { RenderTaskRequest } from '@/types/renderTask.types';

const REFERENCE: RenderTaskReference = { id: 'ref-1', name: 'Arc Lamp', dataUrl: 'data:image/png;base64,aW1nMQ==' };

const INITIAL_STATE: GenerationPlaygroundState = {
    mode: 'new-view',
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

function renderNewView(props: { references?: RenderTaskReference[]; selectedView?: string } = {}) {
    const onGenerate = vi.fn();
    render(
        <GenerationNewViewMode
            state={{ ...INITIAL_STATE, selectedView: props.selectedView ?? '' }}
            referenceCount={(props.references ?? [REFERENCE]).length}
            onUpdate={vi.fn()}
            references={props.references ?? [REFERENCE]}
            task={makeTaskApi()}
            onGenerate={onGenerate}
            onBack={vi.fn()}
        />,
    );
    return { onGenerate };
}

/** Stateful harness so the view picker updates the request. */
function Harness({ references = [REFERENCE], onGenerate }: { references?: RenderTaskReference[]; onGenerate: (request: RenderTaskRequest) => void }) {
    const [state, setState] = useState(INITIAL_STATE);
    return (
        <GenerationNewViewMode
            state={state}
            referenceCount={references.length}
            onUpdate={(patch) => setState((current) => ({ ...current, ...patch }))}
            references={references}
            task={makeTaskApi()}
            onGenerate={onGenerate}
            onBack={vi.fn()}
        />
    );
}

describe('GenerationNewViewMode — US4 behavior (T016)', () => {
    it('submits the selected target view with the connected reference (US4/AC1, FR-016)', () => {
        const { onGenerate } = renderNewView({ selectedView: 'Front' });
        fireEvent.click(screen.getByRole('button', { name: /generate/i }));

        expect(onGenerate).toHaveBeenCalledTimes(1);
        const request = onGenerate.mock.calls[0][0] as RenderTaskRequest;
        expect(request.kind).toBe('new-view');
        expect(request.targetView).toBe('Front');
        expect(request.referenceImageId).toBe('ref-1');
    });

    it('blocks generation until a view is selected (US4/AC2)', () => {
        const { onGenerate } = renderNewView({ selectedView: '' });
        const generate = screen.getByRole('button', { name: /generate/i });
        expect(generate).toBeDisabled();
        fireEvent.click(generate);
        expect(onGenerate).not.toHaveBeenCalled();
    });

    it('requires at least one connected reference (FR-016)', () => {
        const { onGenerate } = renderNewView({ selectedView: 'Front', references: [] });
        expect(screen.getByText(/connect an image/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: /generate/i }));
        expect(onGenerate).not.toHaveBeenCalled();
    });

    it('picks a view from the picker and generates with it (US4/AC1)', () => {
        const onGenerate = vi.fn();
        render(<Harness onGenerate={onGenerate} />);
        fireEvent.click(screen.getByRole('button', { name: 'Select a view' }));
        fireEvent.click(screen.getByRole('option', { name: 'Top' }));
        fireEvent.click(screen.getByRole('button', { name: /generate/i }));

        expect(onGenerate).toHaveBeenCalledTimes(1);
        expect((onGenerate.mock.calls[0][0] as RenderTaskRequest).targetView).toBe('Top');
    });
});
