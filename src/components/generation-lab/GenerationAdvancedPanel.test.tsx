import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GenerationAdvancedPanel } from '@/components/generation-lab/GenerationAdvancedPanel';
import type { AdvancedConfiguration } from '@/components/generation-lab/generationNodeMockup.types';

const DEFAULTS: AdvancedConfiguration = { open: false, steps: 30, guidance: 4, referenceResolution: 1024 };

/** Controlled harness: applies patches like the mode components do. */
function Harness({ initial = DEFAULTS }: { initial?: AdvancedConfiguration }) {
    const [value, setValue] = useState(initial);
    return <GenerationAdvancedPanel value={value} onChange={(patch) => setValue((current) => ({ ...current, ...patch }))} />;
}

describe('GenerationAdvancedPanel — FR-003 MVP set (T010)', () => {
    it('is collapsed by default and expands to reveal exactly the three power-user controls', () => {
        render(<Harness />);
        const toggle = screen.getByRole('button', { name: /advanced/i });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(toggle);
        expect(screen.getByLabelText(/generation quality|steps/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/prompt adherence|guidance/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/reference resolution/i)).toBeInTheDocument();
    });

    it('reports safe defaults: 30 steps, guidance 4.0, 1024 reference resolution', () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole('button', { name: /advanced/i }));

        expect((screen.getByLabelText(/generation quality|steps/i) as HTMLSelectElement).value).toBe('30');
        expect(Number((screen.getByLabelText(/prompt adherence|guidance/i) as HTMLInputElement).value)).toBe(4);
        expect((screen.getByLabelText(/reference resolution/i) as HTMLSelectElement).value).toBe('1024');
    });

    it('patches the advanced configuration on change', () => {
        const onChange = vi.fn();
        render(<GenerationAdvancedPanel value={{ ...DEFAULTS, open: true }} onChange={onChange} />);

        fireEvent.change(screen.getByLabelText(/generation quality|steps/i), { target: { value: '50' } });
        expect(onChange).toHaveBeenCalledWith({ steps: 50 });

        fireEvent.change(screen.getByLabelText(/prompt adherence|guidance/i), { target: { value: '6.5' } });
        expect(onChange).toHaveBeenCalledWith({ guidance: 6.5 });

        fireEvent.change(screen.getByLabelText(/reference resolution/i), { target: { value: '2048' } });
        expect(onChange).toHaveBeenCalledWith({ referenceResolution: 2048 });
    });

    it('never renders deferred controls (mask, LoRA, control conditioning, upscale) in the MVP UI', () => {
        render(<GenerationAdvancedPanel value={{ ...DEFAULTS, open: true }} onChange={vi.fn()} />);
        const text = screen.getByRole('region', { name: /advanced settings/i }).textContent ?? '';
        expect(text).not.toMatch(/mask/i);
        expect(text).not.toMatch(/lora/i);
        expect(text).not.toMatch(/control conditioning|controlnet/i);
        expect(text).not.toMatch(/upscale/i);
    });
});
