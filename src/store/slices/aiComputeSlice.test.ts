import { describe, expect, it } from 'vitest';
import { useStore } from '../useStore';

describe('aiComputeSlice', () => {
    it('persists compute preference and target endpoint state', () => {
        useStore.getState().setComputePreference('balanced');
        useStore.getState().setLocalComfyEndpoint('http://localhost:8188');
        useStore.getState().setExecutionTargetKind('hybrid');

        expect(useStore.getState().computeSettings).toMatchObject({
            preference: 'balanced',
            localEndpoint: 'http://localhost:8188',
            targetKind: 'hybrid',
        });
    });

    it('defaults the FR-021 benchmark launch gate to enabled and toggles it', () => {
        expect(useStore.getState().computeSettings.benchmarkGateEnabled).toBe(true);

        useStore.getState().setBenchmarkGateEnabled(false);
        expect(useStore.getState().computeSettings.benchmarkGateEnabled).toBe(false);

        useStore.getState().applyComputeSettings({ benchmarkGateEnabled: true });
        expect(useStore.getState().computeSettings.benchmarkGateEnabled).toBe(true);
    });
});
