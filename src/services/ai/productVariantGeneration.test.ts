import { describe, expect, it } from 'vitest';
import { createProductVariantRequest } from './productVariantGeneration';

describe('createProductVariantRequest', () => {
    it('groups requested values and preserves the source reference', () => {
        const request = createProductVariantRequest({ prompt: 'Explore finishes', referenceAssetId: 'hero-1', values: ['brushed aluminum', 'matte black'], width: 1024, height: 1024 });
        expect(request).toMatchObject({ workflowId: 'material_study', batchSize: 2, references: [{ assetId: 'hero-1', role: 'primary' }], parameters: { values: ['brushed aluminum', 'matte black'] } });
    });
});
