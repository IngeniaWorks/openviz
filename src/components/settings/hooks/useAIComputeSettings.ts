import { useCallback, useState } from 'react';
import { renderService } from '@/services/renderService';
import type { TargetCapabilities } from '@/types/executionTarget.types';
import { normalizeComfyCapabilities } from '@/services/ai/targets/comfyCapabilitiesService';
import { useStore } from '@/store/useStore';

type ConnectionStatus = 'idle' | 'checking' | 'connected' | 'unavailable';

export function useAIComputeSettings() {
    const settings = useStore((state) => state.computeSettings);
    const setLocalEndpoint = useStore((state) => state.setLocalComfyEndpoint);
    const setHostedEndpoint = useStore((state) => state.setHostedComfyEndpoint);
    const setTargetKind = useStore((state) => state.setExecutionTargetKind);
    const setPreference = useStore((state) => state.setComputePreference);
    const endpoint = settings.targetKind === 'hosted' ? settings.hostedEndpoint : settings.localEndpoint;
    const setEndpoint = settings.targetKind === 'hosted' ? setHostedEndpoint : setLocalEndpoint;
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [capabilities, setCapabilities] = useState<TargetCapabilities | null>(null);

    const refreshCapabilities = useCallback(async () => {
        const [statsResponse, objectInfoResponse] = await Promise.all([
            fetch(`${endpoint}/system_stats`),
            fetch(`${endpoint}/object_info`),
        ]);
        if (!statsResponse.ok || !objectInfoResponse.ok) {
            setCapabilities(null);
            return;
        }
        const stats: unknown = await statsResponse.json();
        const objectInfo: unknown = await objectInfoResponse.json();
        setCapabilities(normalizeComfyCapabilities(stats, objectInfo));
    }, [endpoint]);

    const testConnection = useCallback(async () => {
        setStatus('checking');
        const connected = await renderService.checkConnection();
        setStatus(connected ? 'connected' : 'unavailable');
    }, []);

    return {
        endpoint,
        setEndpoint,
        targetKind: settings.targetKind,
        setTargetKind,
        status,
        preference: settings.preference,
        setPreference,
        capabilities,
        refreshCapabilities,
        testConnection,
    };
}
