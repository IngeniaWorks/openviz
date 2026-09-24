import { useCallback, useState } from 'react';
import { renderService } from '@/services/renderService';
import type { TargetCapabilities } from '@/types/executionTarget.types';
import { normalizeComfyCapabilities } from '@/services/ai/targets/comfyCapabilitiesService';
import { createOpenAIImageTarget } from '@/services/ai/targets/openAIImageTarget';
import { useStore } from '@/store/useStore';

type ConnectionStatus = 'idle' | 'checking' | 'connected' | 'unavailable';

export function useAIComputeSettings() {
    const settings = useStore((state) => state.computeSettings);
    const setLocalEndpoint = useStore((state) => state.setLocalComfyEndpoint);
    const setHostedEndpoint = useStore((state) => state.setHostedComfyEndpoint);
    const setTargetKind = useStore((state) => state.setExecutionTargetKind);
    const setProtocol = useStore((state) => state.setExecutionTargetProtocol);
    const setImageApiEndpoint = useStore((state) => state.setImageApiEndpoint);
    const setImageApiKey = useStore((state) => state.setImageApiKey);
    const setImageApiKeyless = useStore((state) => state.setImageApiKeyless);
    const setImageApiModels = useStore((state) => state.setImageApiModels);
    const setImageApiModel = useStore((state) => state.setImageApiModel);
    const setImageApiSize = useStore((state) => state.setImageApiSize);
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
        try {
            if (settings.protocol === 'openai-image') {
                const target = createOpenAIImageTarget({
                    id: 'image-api',
                    endpoint: settings.imageApiEndpoint,
                    model: settings.imageApiModel,
                    apiKey: settings.imageApiKey,
                    keyless: settings.imageApiKeyless,
                    fetcher: fetch,
                });
                const health = await target.health();
                setImageApiModels(health.capabilities?.availableModels ?? []);
                setStatus(health.status === 'ready' ? 'connected' : 'unavailable');
                return;
            }
            const connected = await renderService.checkConnection();
            setStatus(connected ? 'connected' : 'unavailable');
        } catch {
            setStatus('unavailable');
        }
    }, [settings, setImageApiModels]);

    return {
        endpoint,
        setEndpoint,
        targetKind: settings.targetKind,
        setTargetKind,
        protocol: settings.protocol,
        setProtocol,
        imageApiEndpoint: settings.imageApiEndpoint,
        setImageApiEndpoint,
        imageApiKey: settings.imageApiKey,
        setImageApiKey,
        imageApiKeyless: settings.imageApiKeyless,
        setImageApiKeyless,
        imageApiModels: settings.imageApiModels,
        setImageApiModels,
        imageApiModel: settings.imageApiModel,
        setImageApiModel,
        imageApiSize: settings.imageApiSize,
        setImageApiSize,
        status,
        preference: settings.preference,
        setPreference,
        capabilities,
        refreshCapabilities,
        testConnection,
    };
}
