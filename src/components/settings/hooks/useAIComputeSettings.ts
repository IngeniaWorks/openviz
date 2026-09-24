import { useCallback, useState } from 'react';
import { renderService } from '@/services/renderService';
import type { TargetCapabilities } from '@/types/executionTarget.types';
import { normalizeComfyCapabilities } from '@/services/ai/targets/comfyCapabilitiesService';

type ConnectionStatus = 'idle' | 'checking' | 'connected' | 'unavailable';
type ComputePreference = 'automatic' | 'low-memory' | 'balanced' | 'high-quality' | 'hosted';

export function useAIComputeSettings() {
    const [endpoint, setEndpoint] = useState('/comfy-api');
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [preference, setPreference] = useState<ComputePreference>('automatic');
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
        status,
        preference,
        setPreference,
        capabilities,
        refreshCapabilities,
        testConnection,
    };
}
