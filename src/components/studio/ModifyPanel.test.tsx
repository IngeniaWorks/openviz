import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModifyPanel } from './ModifyPanel';

describe('ModifyPanel', () => {
    it('submits a direct product edit prompt', () => {
        const onGenerate = vi.fn();
        render(<ModifyPanel height={400} onGenerate={onGenerate} />);
        fireEvent.change(screen.getByLabelText('Modify prompt'), { target: { value: 'Change the finish to brushed aluminum.' } });
        fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
        expect(onGenerate).toHaveBeenCalledWith('Change the finish to brushed aluminum.');
    });
});
