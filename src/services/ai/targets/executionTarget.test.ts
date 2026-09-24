import { describe, expect, it, vi } from 'vitest';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';
import { createLocalComfyTarget } from './localComfyTarget';

const request: ProductWorkflowRequest = {
    workflowId: 'product_concept',
    prompt: 'A compact air purifier',
    references: [],
    width: 1024,
    height: 1024,
    batchSize: 1,
    parameters: {},
};

describe('createLocalComfyTarget', () => {
    it('normalizes health and submits a prompt through the ComfyUI API', async () => {
        const fetcher = vi.fn<typeof fetch>();
        fetcher
            .mockResolvedValueOnce(new Response(JSON.stringify({ devices: [] }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ prompt_id: 'prompt-1' }), { status: 200 }));
        const target = createLocalComfyTarget({ id: 'local', endpoint: 'http://localhost:8188', fetcher });

        const health = await target.health();
        expect(health.status).toBe('ready');
        const submitted = await target.submit(request);
        expect(submitted).toEqual({ jobId: 'prompt-1', targetId: 'local' });
        expect(fetcher).toHaveBeenCalledWith('http://localhost:8188/prompt', expect.objectContaining({ method: 'POST' }));
    });

    it('returns an unavailable health state when the endpoint fails', async () => {
        const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'));
        const target = createLocalComfyTarget({ id: 'local', endpoint: 'http://localhost:8188', fetcher });
        const health = await target.health();
        expect(health.status).toBe('unavailable');
        expect(health.message).toContain('offline');
    });
});
