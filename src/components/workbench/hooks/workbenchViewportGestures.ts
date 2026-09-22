export const WORKBENCH_PAN_MOUSE_BUTTON = 1;
export const WORKBENCH_MIN_ZOOM = 0.1;
export const WORKBENCH_MAX_ZOOM = 2;

export function getTrackpadPinchZoom(currentZoom: number, deltaY: number): number {
    const factor = deltaY < 0 ? 1.1 : 0.9;
    return Math.min(WORKBENCH_MAX_ZOOM, Math.max(WORKBENCH_MIN_ZOOM, currentZoom * factor));
}
