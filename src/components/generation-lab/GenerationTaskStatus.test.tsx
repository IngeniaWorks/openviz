import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GenerationTaskStatus } from '@/components/generation-lab/GenerationTaskStatus';
import type { GenerationTaskApi } from '@/components/generation-lab/useRenderTask';
import { useStore } from '@/store/useStore';

function makeIdleTask(): GenerationTaskApi {
    return {
        status: 'idle',
        queuePosition: null,
        error: null,
        outputs: [],
        extraction: null,
        submit: () => undefined,
        cancel: () => undefined,
        retry: () => undefined,
        regenerateWithSeed: () => undefined,
    };
}

describe('GenerationTaskStatus — readiness (T031, spec edge case: model/backend unavailable)', () => {
    it('shows an "AI not ready" note when idle and no image backend is configured', () => {
        const previousSettings = useStore.getState().computeSettings;
        useStore.setState((state) => ({ computeSettings: { ...state.computeSettings, protocol: 'openai-image', imageApiEndpoint: '' } }));
        try {
            render(<GenerationTaskStatus task={makeIdleTask()} />);
            expect(screen.getByText(/AI not ready/i)).toBeInTheDocument();
        } finally {
            useStore.setState({ computeSettings: previousSettings });
        }
    });

    it('shows no readiness note while a backend is configured', () => {
        render(<GenerationTaskStatus task={makeIdleTask()} />);
        expect(screen.queryByText(/AI not ready/i)).not.toBeInTheDocument();
    });
});
