import { describe, expect, it, vi } from 'vitest';
import type { ExecutionTargetAdapter } from '@/types/executionTarget.types';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';
import { cancelProductWorkflow, pollProductWorkflow, submitProductWorkflow } from './generationJobService';

const request: ProductWorkflowRequest = {
    workflowId: 'product_concept', prompt: 'A modular speaker', references: [], width: 1024, height: 1024, batchSize: 1, parameters: {},
};

function adapter(preflightReady: boolean): ExecutionTargetAdapter {
    return {
        health: async () => ({ targetId: 'local', status: 'ready', capabilities: null }),
        capabilities: async () => ({ checkedAt: 1, devices: [], customNodes: [], availableModels: [], availableNodeTypes: [], supportedPrecisions: ['unknown'], supportedWorkflows: [] }),
        preflight: async () => ({ ready: preflightReady, status: preflightReady ? 'ready' : 'missing', issues: preflightReady ? [] : [{ code: 'missing', message: 'Missing model' }] }),
        submit: async () => ({ jobId: 'remote-1', targetId: 'local' }),
        getStatus: async () => ({ jobId: 'remote-1', status: 'queued', progress: 0 }),
        cancel: async () => undefined,
        getOutputs: async () => [],
    };
}

describe('submitProductWorkflow', () => {
    it('submits only after preflight and returns a queued job', async () => {
        const result = await submitProductWorkflow(adapter(true), request, 'local');
        expect(result.status).toBe('queued');
        expect(result.remoteJobId).toBe('remote-1');
    });

    it('returns a failed job draft when preflight is not ready', async () => {
        const result = await submitProductWorkflow(adapter(false), request, 'local');
        expect(result.status).toBe('failed');
        expect(result.error?.retryable).toBe(true);
        expect(result.prompt).toBe(request.prompt);
    });

    it('retains inputs when adapter submission fails', async () => {
        const failingAdapter = { ...adapter(true), submit: async () => { throw new Error('ComfyUI is offline.'); } };
        const result = await submitProductWorkflow(failingAdapter, request, 'local');
        expect(result.status).toBe('failed');
        expect(result.error).toMatchObject({ message: 'ComfyUI is offline.', retryable: true });
    });

    it('normalizes terminal status and outputs', async () => {
        const result = await submitProductWorkflow(adapter(true), request, 'local');
        const synced = await pollProductWorkflow(adapter(true), result);
        expect(synced).toMatchObject({ status: 'queued', progress: 0 });
    });

    it('cancels a submitted remote job', async () => {
        const cancel = vi.fn(async () => undefined);
        const remoteAdapter = { ...adapter(true), cancel };
        const result = await submitProductWorkflow(remoteAdapter, request, 'local');
        const cancelled = await cancelProductWorkflow(remoteAdapter, result);
        expect(cancel).toHaveBeenCalledWith('remote-1');
        expect(cancelled).toMatchObject({ status: 'cancelled', progress: 0 });
    });
});
