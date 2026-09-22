import { describe, expect, it } from 'vitest';
import {
    getTrackpadPinchZoom,
    WORKBENCH_MAX_ZOOM,
    WORKBENCH_MIN_ZOOM,
    WORKBENCH_PAN_MOUSE_BUTTON,
} from './workbenchViewportGestures';

describe('Workbench viewport gestures', () => {
    it('uses the middle mouse button for drag panning', () => {
        expect(WORKBENCH_PAN_MOUSE_BUTTON).toBe(1);
    });

    it('zooms in for pinch-out deltas and out for pinch-in deltas', () => {
        expect(getTrackpadPinchZoom(1, -1)).toBeGreaterThan(1);
        expect(getTrackpadPinchZoom(1, 1)).toBeLessThan(1);
    });

    it('clamps pinch zoom to the supported viewport range', () => {
        expect(getTrackpadPinchZoom(WORKBENCH_MAX_ZOOM, -1)).toBe(WORKBENCH_MAX_ZOOM);
        expect(getTrackpadPinchZoom(WORKBENCH_MIN_ZOOM, 1)).toBe(WORKBENCH_MIN_ZOOM);
    });
});
