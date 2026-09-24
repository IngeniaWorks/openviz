import { describe, expect, it, vi } from 'vitest';
import { createOpenAIImageTarget, parseImageOutputs, parseModels } from './openAIImageTarget';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';

const request: ProductWorkflowRequest = {
    workflowId: 'product_concept',
    prompt: 'A red desk lamp',
    references: [],
    width: 1024,
    height: 1024,
    batchSize: 1,
    parameters: {},
};

describe('openAIImageTarget', () => {
    it('parses OpenAI model objects and image URLs', () => {
        expect(parseModels({ data: [{ id: 'Qwen-Image-2.1' }, { id: 'other' }] })).toEqual(['Qwen-Image-2.1', 'other']);
        expect(parseImageOutputs({ data: [{ url: 'https://images.example/result.png' }, { b64_json: 'ignored' }] })).toEqual([
            { url: 'https://images.example/result.png', index: 0, contentType: 'image/*' },
        ]);
    });

    it('discovers models and sends an authenticated generation request', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'Qwen-Image-2.1' }] }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ url: 'https://images.example/result.png' }] }), { status: 200 }));
        const target = createOpenAIImageTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'Qwen-Image-2.1', apiKey: 'secret', fetcher });

        await expect(target.health()).resolves.toMatchObject({ status: 'ready' });
        await expect(target.submit(request)).resolves.toMatchObject({ targetId: 'unsloth' });
        expect(fetcher.mock.calls[0]?.[0]).toBe('http://localhost:8001/v1/models');
        expect(fetcher.mock.calls[1]?.[0]).toBe('http://localhost:8001/v1/images/generations');
        expect(fetcher.mock.calls[1]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer secret' });
        expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({ model: 'Qwen-Image-2.1', prompt: request.prompt, size: '1024x1024' });
        await expect(target.getOutputs('image-api-1')).resolves.toEqual([{ url: 'https://images.example/result.png', index: 0, contentType: 'image/*' }]);
    });

    it('requires a key unless keyless mode is explicitly enabled', async () => {
        const fetcher = vi.fn<typeof fetch>();
        const target = createOpenAIImageTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'model', fetcher });
        await expect(target.health()).resolves.toMatchObject({ status: 'auth-required' });
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('reports authentication failures clearly', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), { status: 401 }));
        const target = createOpenAIImageTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'model', apiKey: 'bad', fetcher });
        await expect(target.health()).resolves.toMatchObject({ status: 'auth-required', message: expect.stringContaining('Authorization header') });
    });
});
