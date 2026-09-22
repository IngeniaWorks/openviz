import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CollabStatusChip } from './CollabStatusChip';

describe('CollabStatusChip (US3 / SC-004)', () => {
    it('shows a live indicator when connected', () => {
        render(<CollabStatusChip status="connected" />);
        expect(screen.getByRole('status')).toHaveTextContent(/live/i);
    });

    it('shows the queued state while offline and never claims a durable save', () => {
        render(<CollabStatusChip status="offline-queued" />);

        const chip = screen.getByRole('status');
        expect(chip).toHaveTextContent(/offline/i);
        // Edits are only safe in the local queue + IndexedDB — no "saved"/"synced" claim.
        expect(chip.textContent).not.toMatch(/saved|synced/i);
    });

    it('shows a connecting state before the first sync', () => {
        render(<CollabStatusChip status="connecting" />);
        expect(screen.getByRole('status')).toHaveTextContent(/connecting/i);
    });

    it('renders nothing when there is no session (idle)', () => {
        const { container } = render(<CollabStatusChip status="idle" />);
        expect(container).toBeEmptyDOMElement();
    });
});
