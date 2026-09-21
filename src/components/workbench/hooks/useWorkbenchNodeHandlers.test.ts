import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MediaWorkbenchNode, NoteWorkbenchNode } from '@/types';
import { useWorkbenchNodeHandlers } from './useWorkbenchNodeHandlers';

const note: NoteWorkbenchNode = {
    id: 'note-1',
    type: 'note',
    x: 10,
    y: 20,
    data: { text: 'Test', colorVariant: 'yellow' },
};

function renderHandlers(workbenchNode: NoteWorkbenchNode | MediaWorkbenchNode = note) {
    const updateWorkbenchNode = vi.fn();
    const updateWorkbenchNodeTransient = vi.fn();
    const openNodeInStudio = vi.fn();
    const options = {
        workbenchNodes: [workbenchNode],
        selectedNodeIds: ['note-1'],
        setSelectedNodeIds: vi.fn(),
        updateWorkbenchNode,
        updateWorkbenchNodeTransient,
        beginWorkbenchGesture: vi.fn(),
        commitWorkbenchGesture: vi.fn(),
        cancelWorkbenchGesture: vi.fn(),
        removeWorkbenchNode: vi.fn(),
        openNodeInStudio,
        setActiveNodeId: vi.fn(),
        setBasicBlocksMenu: vi.fn(),
    };

    return {
        ...renderHook(() => useWorkbenchNodeHandlers(options)),
        updateWorkbenchNode,
        updateWorkbenchNodeTransient,
        openNodeInStudio,
    };
}

describe('useWorkbenchNodeHandlers gesture updates', () => {
    it('opens uploaded media in the editor on double-click', () => {
        const media: MediaWorkbenchNode = {
            id: 'media-1',
            type: 'media',
            x: 10,
            y: 20,
            data: { src: 'blob:test', alt: 'photo.png', mimeType: 'image/png' },
        };
        const { result, openNodeInStudio } = renderHandlers(media);

        act(() => {
            result.current.handleNodeDoubleClick({} as React.MouseEvent, { id: media.id } as never);
        });

        expect(openNodeInStudio).toHaveBeenCalledWith(media.id);
    });

    it('routes position changes to transient updates during drag', () => {
        const { result, updateWorkbenchNode, updateWorkbenchNodeTransient } = renderHandlers();

        act(() => {
            result.current.handleNodesChange([
                { id: 'note-1', type: 'position', position: { x: 50, y: 60 } },
            ]);
        });

        expect(updateWorkbenchNodeTransient).toHaveBeenCalledWith('note-1', { x: 50, y: 60 });
        expect(updateWorkbenchNode).not.toHaveBeenCalled();
    });
});
