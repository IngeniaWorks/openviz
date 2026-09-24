import type { StateCreator } from 'zustand';
import type { AppState } from '../storeTypes';
import type { ComputePreference, ComputeSettings, ExecutionTargetKind } from '@/types/executionTarget.types';

export interface AIComputeSlice {
    computeSettings: ComputeSettings;
    setComputePreference: (preference: ComputePreference) => void;
    setLocalComfyEndpoint: (endpoint: string) => void;
    setHostedComfyEndpoint: (endpoint: string) => void;
    setExecutionTargetKind: (kind: ExecutionTargetKind) => void;
}

export const createAIComputeSlice: StateCreator<AppState, [], [], AIComputeSlice> = (set) => ({
    computeSettings: {
        targetKind: 'local',
        preference: 'automatic',
        localEndpoint: '/comfy-api',
        hostedEndpoint: '',
    },
    setComputePreference: (preference) => set((state) => ({ computeSettings: { ...state.computeSettings, preference } })),
    setLocalComfyEndpoint: (localEndpoint) => set((state) => ({ computeSettings: { ...state.computeSettings, localEndpoint } })),
    setHostedComfyEndpoint: (hostedEndpoint) => set((state) => ({ computeSettings: { ...state.computeSettings, hostedEndpoint } })),
    setExecutionTargetKind: (targetKind) => set((state) => ({ computeSettings: { ...state.computeSettings, targetKind } })),
});
