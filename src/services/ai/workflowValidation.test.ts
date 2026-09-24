import { describe, expect, it } from 'vitest';
import { validateProductWorkflowRequest, buildProductPrompt } from './workflowValidation';

const baseRequest = {
    workflowId: 'product_edit',
    prompt: 'Replace the plastic housing with brushed aluminum.',
    references: [{ assetId: 'asset-1', role: 'primary' as const }],
    width: 1024,
    height: 1024,
    batchSize: 1,
    parameters: {},
};

describe('validateProductWorkflowRequest', () => {
    it('requires a prompt for prompt-driven workflows', () => {
        const result = validateProductWorkflowRequest({ ...baseRequest, prompt: '' });
        expect(result.valid).toBe(false);
        expect(result.issues).toContainEqual(expect.objectContaining({ field: 'prompt' }));
    });

    it('requires a primary reference for product edits', () => {
        const result = validateProductWorkflowRequest({ ...baseRequest, references: [] });
        expect(result.valid).toBe(false);
        expect(result.issues).toContainEqual(expect.objectContaining({ field: 'references' }));
    });

    it('rejects invalid dimensions and batch sizes', () => {
        const result = validateProductWorkflowRequest({ ...baseRequest, width: 0, height: -1, batchSize: 0 });
        expect(result.valid).toBe(false);
        expect(result.issues.map((issue) => issue.field)).toEqual(expect.arrayContaining(['width', 'height', 'batchSize']));
    });

    it('builds a prompt with typed request injections', () => {
        const prompt = buildProductPrompt({
            ...baseRequest,
            negativePrompt: 'text, watermark',
            maskAssetId: 'mask.png',
            seed: 42,
            batchSize: 2,
        });

        expect(prompt.prompt).toMatchObject({
            prompt: { inputs: { text: baseRequest.prompt } },
            negative_prompt: { inputs: { text: 'text, watermark' } },
            sampler: { inputs: { seed: 42 } },
            reference_image: { inputs: { image: 'asset-1' } },
            mask: { inputs: { image: 'mask.png' } },
            width: { inputs: { width: 1024 } },
            height: { inputs: { height: 1024 } },
            batch_size: { inputs: { batch_size: 2 } },
        });
    });
});
