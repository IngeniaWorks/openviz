import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { NodeLockState } from '@/types';
import { NodeLockBadges } from './NodeLockBadges';

const viewport = { x: 0, y: 0, zoom: 1 };

function flowNode(id: string, x: number, y: number) {
    return { id, type: 'text', position: { x, y }, data: {} as Record<string, unknown> };
}

describe('NodeLockBadges', () => {
    it('renders a badge naming the lock holder at each locked node (screen space)', () => {
        const locks: Record<string, NodeLockState> = {
            n1: { nodeId: 'n1', userId: 'u-2', userName: 'Grace' },
        };

        render(<NodeLockBadges nodes={[flowNode('n1', 40, 60)]} nodeLocks={locks} viewport={{ x: 10, y: 5, zoom: 3 }} />);

        const badge = screen.getByText(/Grace/).closest('[data-lock-node="n1"]') as HTMLElement;
        expect(badge).not.toBeNull();
        // Node top-left (40,60) → screen (40×3+10, 60×3+5)
        expect(badge.style.left).toBe('130px');
        expect(badge.style.top).toBe('185px');
    });

    it('renders nothing when there are no remote locks', () => {
        const { container } = render(
            <NodeLockBadges nodes={[flowNode('n1', 0, 0)]} nodeLocks={{}} viewport={viewport} />,
        );
        expect(container.querySelectorAll('[data-lock-node]')).toHaveLength(0);
    });

    it('ignores locks for nodes that no longer exist on the canvas', () => {
        const locks: Record<string, NodeLockState> = {
            ghost: { nodeId: 'ghost', userId: 'u-2', userName: 'Grace' },
        };

        const { container } = render(
            <NodeLockBadges nodes={[flowNode('n1', 0, 0)]} nodeLocks={locks} viewport={viewport} />,
        );
        expect(container.querySelectorAll('[data-lock-node]')).toHaveLength(0);
    });
});
