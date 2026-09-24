import { describe, expect, it } from 'vitest';
import { getProductWorkflow, listProductWorkflows } from './productWorkflowRegistry';

describe('product workflow registry', () => {
    it('exposes the task-oriented product workflows', () => {
        const workflows = listProductWorkflows();

        expect(workflows.map((workflow) => workflow.id)).toEqual(expect.arrayContaining([
            'product_concept',
            'product_edit',
            'material_study',
            'sketch_to_render',
            'product_background',
            'product_animation',
        ]));
    });

    it('returns versioned workflow metadata and injection points', () => {
        const workflow = getProductWorkflow('product_edit');

        expect(workflow).toMatchObject({
            id: 'product_edit',
            version: expect.any(String),
            category: 'edit',
            nodes: expect.objectContaining({ prompt: expect.any(String) }),
            dependencies: expect.any(Array),
        });
    });

    it('returns undefined for an unknown workflow', () => {
        expect(getProductWorkflow('unknown_product_workflow')).toBeUndefined();
    });
});
