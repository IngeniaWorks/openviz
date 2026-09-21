import { describe, expect, it } from 'vitest';
import { WorkbenchNode } from '@/types';
import { getCanonicalConnectionFromDrop } from './workbenchConnectionLogic';

function createNode(type: WorkbenchNode['type'], id: string): WorkbenchNode {
    if (type === 'image') {
        return {
            id,
            type: 'image',
            name: id,
            x: 0,
            y: 0,
            project: {
                id,
                name: id,
                createdAt: 0,
                lastModifiedAt: 0,
                canvas: {
                    width: 512,
                    height: 512,
                    aspectRatio: 'square',
                    zoomLevel: 1,
                    panX: 0,
                    panY: 0,
                    backgroundColor: '#fff',
                },
                layers: [],
            },
        };
    }

    if (type === 'video') {
        return {
            id,
            type: 'video',
            name: id,
            x: 0,
            y: 0,
            project: {
                id,
                name: id,
                createdAt: 0,
                lastModifiedAt: 0,
                canvas: {
                    width: 512,
                    height: 512,
                    aspectRatio: 'square',
                    zoomLevel: 1,
                    panX: 0,
                    panY: 0,
                    backgroundColor: '#000',
                },
                layers: [],
            },
        };
    }

    if (type === 'animate') {
        return {
            id,
            type: 'animate',
            x: 0,
            y: 0,
            data: {
                prompt: '',
                frames: {},
                settings: {
                    model: 'default',
                    duration: '2s',
                },
            },
        };
    }

    return {
        id,
        type: 'render',
        x: 0,
        y: 0,
        data: {
            prompt: '',
            stylePreset: 'Photorealistic',
            drawingInfluence: 0.5,
            numImages: 1,
        },
    };
}

describe('getCanonicalConnectionFromDrop', () => {
    it('maps reverse drag from animate target to image into image -> animate', () => {
        const nodes: WorkbenchNode[] = [createNode('animate', 'animate-1'), createNode('image', 'image-1')];
        const result = getCanonicalConnectionFromDrop({ nodeId: 'animate-1', handleType: 'target' }, 'image-1', nodes);
        expect(result).toEqual({
            fromId: 'image-1',
            toId: 'animate-1',
            sourceHandle: 'image-source',
            targetHandle: null,
        });
    });

    it('maps reverse drag from render target to image into image -> render', () => {
        const nodes: WorkbenchNode[] = [createNode('render', 'render-1'), createNode('image', 'image-1')];
        const result = getCanonicalConnectionFromDrop({ nodeId: 'render-1', handleType: 'target' }, 'image-1', nodes);
        expect(result).toEqual({
            fromId: 'image-1',
            toId: 'render-1',
            sourceHandle: 'image-source',
            targetHandle: null,
        });
    });

    it('returns null for non-image drop target or non-target handle starts', () => {
        const nodes: WorkbenchNode[] = [
            createNode('render', 'render-1'),
            createNode('animate', 'animate-1'),
            createNode('video', 'video-1'),
            createNode('image', 'image-1'),
        ];

        expect(getCanonicalConnectionFromDrop({ nodeId: 'render-1', handleType: 'target' }, 'video-1', nodes)).toBeNull();
        expect(getCanonicalConnectionFromDrop({ nodeId: 'animate-1', handleType: 'source' }, 'image-1', nodes)).toBeNull();
    });

    it('returns null when start/target/node lookup is missing', () => {
        const nodes: WorkbenchNode[] = [createNode('render', 'render-1'), createNode('image', 'image-1')];
        expect(getCanonicalConnectionFromDrop(null, 'image-1', nodes)).toBeNull();
        expect(getCanonicalConnectionFromDrop({ nodeId: 'missing', handleType: 'target' }, 'image-1', nodes)).toBeNull();
        expect(getCanonicalConnectionFromDrop({ nodeId: 'render-1', handleType: 'target' }, null, nodes)).toBeNull();
    });
});
