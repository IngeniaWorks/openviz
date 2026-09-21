import { describe, expect, it } from 'vitest';

// T020: pure media-upload logic (FR-012, C-4.4). Module under test:
// src/services/workbench/mediaUploadLogic.ts (T023 implements it).

describe('isImageFile (FR-012 image-only validation)', () => {
    it('accepts common image mime types', async () => {
        const { isImageFile } = await import('./mediaUploadLogic');
        expect(isImageFile({ type: 'image/png' })).toBe(true);
        expect(isImageFile({ type: 'image/jpeg' })).toBe(true);
        expect(isImageFile({ type: 'image/webp' })).toBe(true);
    });

    it('rejects non-image and missing mime types', async () => {
        const { isImageFile } = await import('./mediaUploadLogic');
        expect(isImageFile({ type: 'video/mp4' })).toBe(false);
        expect(isImageFile({ type: 'application/pdf' })).toBe(false);
        expect(isImageFile({ type: '' })).toBe(false);
        expect(isImageFile({})).toBe(false);
    });
});

describe('buildMediaNode (data-model Media entity)', () => {
    it('produces a media node centered on the viewport point with file metadata', async () => {
        const { buildMediaNode } = await import('./mediaUploadLogic');
        const node = buildMediaNode({
            src: 'blob:http://localhost/abc',
            fileName: 'pic.png',
            mimeType: 'image/png',
            centerPoint: { x: 500, y: 300 },
        });

        expect(node.type).toBe('media');
        // Default box 260x180 centered on the pointer
        expect(node.width).toBe(260);
        expect(node.height).toBe(180);
        expect(node.x).toBe(500 - 130);
        expect(node.y).toBe(300 - 90);
        expect(node.data).toEqual({
            src: 'blob:http://localhost/abc',
            alt: 'pic.png',
            mimeType: 'image/png',
        });
    });

    it('falls back to a generic alt when the file has no name', async () => {
        const { buildMediaNode } = await import('./mediaUploadLogic');
        const node = buildMediaNode({
            src: 'blob:http://localhost/xyz',
            fileName: '',
            mimeType: 'image/jpeg',
            centerPoint: { x: 10, y: 20 },
        });
        expect(node.data.alt).toBe('Uploaded media');
    });
});

describe('resolveCenterFlowPoint (viewport-center placement)', () => {
    it('maps the wrapper rect center into flow coordinates', async () => {
        const { resolveCenterFlowPoint } = await import('./mediaUploadLogic');
        const screenToFlowPosition = (p: { x: number; y: number }) => ({
            x: p.x * 2,
            y: p.y * 2,
        });
        const rect = { left: 100, top: 50, width: 800, height: 600 } as DOMRect;
        // Center (500, 350) -> flow (1000, 700)
        expect(resolveCenterFlowPoint(rect, screenToFlowPosition)).toEqual({ x: 1000, y: 700 });
    });

    it('falls back to a default canvas point when no wrapper rect is available', async () => {
        const { resolveCenterFlowPoint } = await import('./mediaUploadLogic');
        expect(resolveCenterFlowPoint(null, (p) => p)).toEqual({ x: 200, y: 200 });
    });
});
