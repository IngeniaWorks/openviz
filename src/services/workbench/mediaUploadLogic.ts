import type { MediaWorkbenchNode } from '@/types';
import { generateUUID } from '@/utils/uuid';

/**
 * Pure media-upload logic (research R4): file validation, node building, and
 * viewport-center placement. No DOM/URL APIs here so the rules are unit-
 * testable; the view layer supplies the object URL and screen mapping.
 */

export interface MediaFileLike {
    type?: string;
}

/** FR-012: only image/* mime types are accepted. */
export function isImageFile(file: MediaFileLike): boolean {
    return typeof file.type === 'string' && file.type.startsWith('image/');
}

export interface BuildMediaNodeInput {
    src: string;
    fileName: string;
    mimeType: string;
    centerPoint: { x: number; y: number };
}

const MEDIA_NODE_WIDTH = 260;
const MEDIA_NODE_HEIGHT = 180;
const DEFAULT_CENTER_POINT = { x: 200, y: 200 };

/** Builds a media node centered on the given flow point (data-model Media entity). */
export function buildMediaNode({ src, fileName, mimeType, centerPoint }: BuildMediaNodeInput): MediaWorkbenchNode {
    return {
        id: generateUUID(),
        type: 'media',
        x: centerPoint.x - MEDIA_NODE_WIDTH / 2,
        y: centerPoint.y - MEDIA_NODE_HEIGHT / 2,
        width: MEDIA_NODE_WIDTH,
        height: MEDIA_NODE_HEIGHT,
        data: {
            src,
            alt: fileName || 'Uploaded media',
            mimeType,
        },
    };
}

/**
 * Maps the wrapper element's rect center into flow coordinates; falls back to
 * a default canvas point when no rect is available (e.g. before first layout).
 */
export function resolveCenterFlowPoint(
    rect: DOMRect | null | undefined,
    screenToFlowPosition: (point: { x: number; y: number }) => { x: number; y: number }
): { x: number; y: number } {
    if (!rect) {
        return DEFAULT_CENTER_POINT;
    }
    return screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
    });
}
