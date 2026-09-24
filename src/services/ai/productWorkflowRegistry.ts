import type {
    ProductModelFamily,
    ProductWorkflowDefinition,
    WorkflowDependency,
} from '@/types/productWorkflow.types';

const qwenImageDependencies: WorkflowDependency[] = [
    {
        kind: 'diffusion-model',
        name: 'qwen_image_2.1',
        locations: ['models/diffusion_models'],
        required: true,
        status: 'unknown',
    },
    {
        kind: 'text-encoder',
        name: 'qwen_2.5_vl_7b',
        locations: ['models/text_encoders'],
        required: true,
        status: 'unknown',
    },
    {
        kind: 'vae',
        name: 'qwen_image_vae',
        locations: ['models/vae'],
        required: true,
        status: 'unknown',
    },
];

const qwenEditDependencies: WorkflowDependency[] = [
    ...qwenImageDependencies,
    {
        kind: 'diffusion-model',
        name: 'qwen_image_edit_2511',
        locations: ['models/diffusion_models'],
        required: true,
        status: 'unknown',
    },
];

const fluxKontextDependencies: WorkflowDependency[] = [
    {
        kind: 'diffusion-model',
        name: 'flux1-dev-kontext',
        locations: ['models/diffusion_models'],
        required: true,
        licenseUrl: 'https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev',
        status: 'unknown',
    },
];

const wanDependencies: WorkflowDependency[] = [
    {
        kind: 'diffusion-model',
        name: 'wan2.2_i2v',
        locations: ['models/diffusion_models'],
        required: true,
        status: 'unknown',
    },
    {
        kind: 'custom-node',
        name: 'ComfyUI-WanVideoWrapper',
        locations: ['custom_nodes'],
        required: true,
        status: 'unknown',
    },
];

const familyNodes = {
    prompt: 'prompt',
    negativePrompt: 'negative_prompt',
    seed: 'sampler',
    reference: 'reference_image',
    mask: 'mask',
    width: 'width',
    height: 'height',
    batchSize: 'batch_size',
    imageOutput: 'save_image',
    videoOutput: 'save_video',
};

function createWorkflow(
    definition: Omit<ProductWorkflowDefinition, 'template' | 'nodes'>
): ProductWorkflowDefinition {
    return {
        ...definition,
        template: {
            prompt: { class_type: 'CLIPTextEncode', inputs: {} },
            sampler: { class_type: 'KSampler', inputs: {} },
            save_image: { class_type: 'SaveImage', inputs: {} },
        },
        nodes: familyNodes,
    };
}

const workflows: ProductWorkflowDefinition[] = [
    createWorkflow({
        id: 'product_concept',
        name: 'Product Concept',
        description: 'Explore industrial-design concepts from a structured product prompt.',
        category: 'concept',
        version: '1.0.0',
        type: 'image',
        supportedFamilies: ['qwen-image-2.1'],
        inputs: [
            { id: 'prompt', kind: 'prompt', label: 'Product description', required: true },
            { id: 'aspectRatio', kind: 'aspect-ratio', label: 'Aspect ratio', required: true, defaultValue: '1:1' },
            { id: 'batchSize', kind: 'batch-size', label: 'Concept count', required: true, defaultValue: 4 },
        ],
        dependencies: qwenImageDependencies,
        capabilities: {
            supportsBatch: true,
            supportsMask: false,
            supportsVideo: false,
            supportsAspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
            minimumFreeVramMb: 10000,
        },
    }),
    createWorkflow({
        id: 'product_edit',
        name: 'Modify Product',
        description: 'Change a product while preserving its selected identity attributes.',
        category: 'edit',
        version: '1.0.0',
        type: 'image',
        supportedFamilies: ['qwen-image-edit-2511', 'flux-kontext-dev'],
        inputs: [
            { id: 'prompt', kind: 'prompt', label: 'What should change?', required: true },
            { id: 'reference', kind: 'reference', label: 'Source product', required: true },
            { id: 'mask', kind: 'mask', label: 'Edit mask', required: false },
            { id: 'preservation', kind: 'preservation', label: 'Preserve structure', required: true, defaultValue: 0.78 },
            { id: 'aspectRatio', kind: 'aspect-ratio', label: 'Aspect ratio', required: true, defaultValue: '1:1' },
        ],
        dependencies: [...qwenEditDependencies, ...fluxKontextDependencies],
        capabilities: {
            supportsBatch: true,
            supportsMask: true,
            supportsVideo: false,
            supportsAspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
            minimumFreeVramMb: 12000,
        },
    }),
    createWorkflow({
        id: 'material_study',
        name: 'Material & Color Study',
        description: 'Generate material, color, and finish variants from a product reference.',
        category: 'variant',
        version: '1.0.0',
        type: 'image',
        supportedFamilies: ['qwen-image-edit-2511', 'flux-kontext-dev'],
        inputs: [
            { id: 'prompt', kind: 'prompt', label: 'Variant instruction', required: true },
            { id: 'reference', kind: 'reference', label: 'Source product', required: true },
            { id: 'batchSize', kind: 'batch-size', label: 'Variant count', required: true, defaultValue: 4 },
        ],
        dependencies: [...qwenEditDependencies, ...fluxKontextDependencies],
        capabilities: {
            supportsBatch: true,
            supportsMask: true,
            supportsVideo: false,
            supportsAspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
            minimumFreeVramMb: 12000,
        },
    }),
    createWorkflow({
        id: 'sketch_to_render',
        name: 'Sketch to Render',
        description: 'Turn a sketch or CAD screenshot into a realistic product visualization.',
        category: 'render',
        version: '1.0.0',
        type: 'image',
        supportedFamilies: ['qwen-image-edit-2511', 'flux-kontext-dev'],
        inputs: [
            { id: 'prompt', kind: 'prompt', label: 'Rendering direction', required: true },
            { id: 'reference', kind: 'reference', label: 'Sketch or CAD image', required: true },
            { id: 'structureStrength', kind: 'structure-strength', label: 'Structure strength', required: true, defaultValue: 0.75 },
        ],
        dependencies: [...qwenEditDependencies, ...fluxKontextDependencies],
        capabilities: {
            supportsBatch: true,
            supportsMask: true,
            supportsVideo: false,
            supportsAspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
            minimumFreeVramMb: 12000,
        },
    }),
    createWorkflow({
        id: 'product_background',
        name: 'Product Background',
        description: 'Create catalog, e-commerce, or lifestyle backgrounds around a product.',
        category: 'background',
        version: '1.0.0',
        type: 'image',
        supportedFamilies: ['qwen-image-edit-2511', 'flux-kontext-dev'],
        inputs: [
            { id: 'prompt', kind: 'prompt', label: 'Scene direction', required: true },
            { id: 'reference', kind: 'reference', label: 'Product image', required: true },
            { id: 'mask', kind: 'mask', label: 'Product mask', required: false },
            { id: 'aspectRatio', kind: 'aspect-ratio', label: 'Marketing ratio', required: true, defaultValue: '1:1' },
        ],
        dependencies: [...qwenEditDependencies, ...fluxKontextDependencies],
        capabilities: {
            supportsBatch: true,
            supportsMask: true,
            supportsVideo: false,
            supportsAspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
            minimumFreeVramMb: 12000,
        },
    }),
    createWorkflow({
        id: 'product_animation',
        name: 'Product Animation',
        description: 'Animate a selected hero image with product-aware motion.',
        category: 'animation',
        version: '1.0.0',
        type: 'video',
        supportedFamilies: ['wan-2.2'],
        inputs: [
            { id: 'prompt', kind: 'motion', label: 'Motion direction', required: false },
            { id: 'reference', kind: 'reference', label: 'Hero image', required: true },
            { id: 'duration', kind: 'duration', label: 'Duration', required: true, defaultValue: '4s' },
        ],
        dependencies: wanDependencies,
        capabilities: {
            supportsBatch: false,
            supportsMask: false,
            supportsVideo: true,
            supportsAspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
            minimumFreeVramMb: 24000,
        },
    }),
];

const workflowMap = new Map(workflows.map((workflow) => [workflow.id, workflow]));

export function listProductWorkflows(): ProductWorkflowDefinition[] {
    return [...workflows];
}

export function getProductWorkflow(id: string): ProductWorkflowDefinition | undefined {
    return workflowMap.get(id);
}

export function getProductWorkflowsForFamily(family: ProductModelFamily): ProductWorkflowDefinition[] {
    return workflows.filter((workflow) => workflow.supportedFamilies.includes(family));
}
