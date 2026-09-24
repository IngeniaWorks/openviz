import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComputePopover } from './ComputePopover';

describe('ComputePopover', () => {
    it('opens target details from the compact control', () => {
        render(<ComputePopover target="Local ComfyUI" tier="Auto" onOpenSettings={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Compute details' }));
        expect(screen.getByText('Local ComfyUI')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Open AI & Compute settings' })).toBeInTheDocument();
    });
});
