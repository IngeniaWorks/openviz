import { describe, expect, it } from 'vitest';
import type { ArrowWorkbenchNode, MediaWorkbenchNode, NoteWorkbenchNode, TextWorkbenchNode } from '@/types';
import { useStore } from '../useStore';

// T005: one-shot creation action (FR-007, C-4.x) — must be atomic:
// append node + select it + switch tool to 'select' in one update.
function textNode(id: string): TextWorkbenchNode {
    return { id, type: 'text', x: 10, y: 20, data: { text: 'hello', fontSize: 16, color: '#fff' } };
}

function noteNode(id: string): NoteWorkbenchNode {
    return { id, type: 'note', x: 30, y: 40, data: { text: 'sticky', colorVariant: 'yellow' } };
}

function arrowNode(id: string): ArrowWorkbenchNode {
    return {
        id,
        type: 'arrow',
        x: 50,
        y: 60,
        data: {
            start: { x: 0, y: 0 },
            end: { x: 100, y: 0 },
            control: { x: 50, y: -20 },
            strokeColor: '#fff',
            strokeWidth: 3,
        },
    };
}

function mediaNode(id: string): MediaWorkbenchNode {
    return { id, type: 'media', x: 70, y: 80, width: 260, height: 180, data: { src: 'blob:http://localhost/abc', alt: 'pic.png', mimeType: 'image/png' } };
}

describe('createOneShotNode (FR-007)', () => {
    it.each([
        ['text', textNode],
        ['note', noteNode],
        ['arrow', arrowNode],
        ['media', mediaNode],
    ] as const)('appends a %s node, selects it, and switches tool to select', (_label, factory) => {
        const id = `one-shot-${Math.random().toString(36).slice(2)}`;
        const store = useStore.getState();

        // Put the store in a one-shot tool state first (as if the user picked the tool)
        store.setActiveWorkbenchTool('text');
        expect(useStore.getState().activeWorkbenchTool).toBe('text');

        store.createOneShotNode(factory(id));

        const next = useStore.getState();
        expect(next.workbenchNodes.some((n) => n.id === id)).toBe(true);
        expect(next.activeNodeId).toBe(id);
        expect(next.selectedNodeIds).toEqual([id]);
        expect(next.activeWorkbenchTool).toBe('select');
    });

    it('switches from any one-shot tool, not just text', () => {
        const id = `one-shot-any-${Math.random().toString(36).slice(2)}`;
        const store = useStore.getState();
        store.setActiveWorkbenchTool('media');
        store.createOneShotNode(mediaNode(id));
        expect(useStore.getState().activeWorkbenchTool).toBe('select');
    });
});
