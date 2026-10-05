import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GenerationResultNode } from '@/components/generation-lab/GenerationResultNode';
import type { RenderTaskOutputState } from '@/store/slices/renderTaskSlice';

const OUTPUTS: RenderTaskOutputState[] = [
    { id: 'o1', url: 'data:image/png;base64,eA==', seed: 7 },
    { id: 'o2', url: 'data:image/png;base64,eQ==', seed: 8 },
    { id: 'o3' },
];

describe('GenerationResultNode (T032)', () => {
    it('renders one mockup node per output, images and structured results alike', () => {
        render(<GenerationResultNode outputs={OUTPUTS} onRegenerateWithSeed={() => undefined} />);

        const nodes = screen.getAllByRole('group', { name: /generation result/i });
        expect(nodes).toHaveLength(3);
        expect(screen.getByAltText(/generated output 7/i)).toBeInTheDocument();
        expect(screen.getByText('Structured result')).toBeInTheDocument();
    });

    it('exposes the seed lock (SC-008) per seeded output and reports the output id', () => {
        const onRegenerateWithSeed = vi.fn();
        render(<GenerationResultNode outputs={OUTPUTS} onRegenerateWithSeed={onRegenerateWithSeed} />);

        fireEvent.click(screen.getByRole('button', { name: 'Lock seed 7 and regenerate' }));
        expect(onRegenerateWithSeed).toHaveBeenCalledWith('o1');

        // o3 has no seed → only the two seeded outputs expose a lock control.
        expect(screen.getAllByRole('button', { name: /lock seed/i })).toHaveLength(2);
    });

    it('renders nothing without outputs', () => {
        const { container } = render(<GenerationResultNode outputs={[]} onRegenerateWithSeed={() => undefined} />);
        expect(container).toBeEmptyDOMElement();
    });
});
