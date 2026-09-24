import React, { useMemo, useState } from 'react';
import { createLocalComfyTarget } from '@/services/ai/targets/localComfyTarget';
import type { AspectRatio } from '@/types';
import { generateUUID } from '@/utils/uuid';
import { useStore } from '@/store/useStore';
import { useProductGeneration } from './hooks/useProductGeneration';
import { ProductParameterForm } from './ProductParameterForm';
import { ProductVariantGallery } from './ProductVariantGallery';
import { ProductWorkflowPicker } from './ProductWorkflowPicker';

function dimensionsForRatio(ratio: AspectRatio): { width: number; height: number } {
    if (ratio === '4:3') return { width: 1200, height: 900 };
    if (ratio === '3:4') return { width: 900, height: 1200 };
    if (ratio === '16:9') return { width: 1344, height: 768 };
    if (ratio === '9:16') return { width: 768, height: 1344 };
    return { width: 1024, height: 1024 };
}

export const ProductWorkflowPanel: React.FC = () => {
    const settings = useStore((state) => state.computeSettings);
    const projectId = useStore((state) => state.currentProjectId);
    const upsertProductReference = useStore((state) => state.upsertProductReference);
    const addImageToWorkbench = useStore((state) => state.addImageToWorkbench);
    const [workflowId, setWorkflowId] = useState('product_concept');
    const [prompt, setPrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [batchSize, setBatchSize] = useState(4);
    const [formError, setFormError] = useState<string | undefined>();
    const dimensions = dimensionsForRatio(aspectRatio);
    const adapter = useMemo(() => settings.targetKind === 'local' && settings.localEndpoint
        ? createLocalComfyTarget({ id: 'local', endpoint: settings.localEndpoint })
        : null, [settings.localEndpoint, settings.targetKind]);
    const generation = useProductGeneration({ adapter, targetKind: settings.targetKind, targetId: settings.targetKind, projectId: projectId ?? undefined });
    const jobs = Object.values(generation.jobs).filter((job) => job.workflowId === workflowId);

    async function handleSubmit() {
        if (!prompt.trim()) {
            setFormError('Describe the product before generating.');
            return;
        }
        if (workflowId !== 'product_concept') {
            setFormError('This workflow is selected in the registry and its dedicated form is coming next.');
            return;
        }
        setFormError(undefined);
        try {
            await generation.generateConcept({ prompt, negativePrompt, aspectRatio, ...dimensions, batchSize });
        } catch (error) {
            setFormError(error instanceof Error ? error.message : 'Unable to start generation.');
        }
    }

    return (
        <aside className="pointer-events-auto flex h-full flex-col gap-5 overflow-y-auto bg-[#0d0d12] p-4 text-zinc-300" aria-label="Product workflow panel">
            <ProductWorkflowPicker selectedWorkflowId={workflowId} onChange={setWorkflowId} />
            <ProductParameterForm prompt={prompt} negativePrompt={negativePrompt} batchSize={batchSize} aspectRatio={aspectRatio} isSubmitting={generation.isGenerating} error={formError ?? generation.error ?? undefined} onPromptChange={setPrompt} onNegativePromptChange={setNegativePrompt} onBatchSizeChange={setBatchSize} onAspectRatioChange={setAspectRatio} onSubmit={() => void handleSubmit()} />
            <ProductVariantGallery jobs={jobs} onSelectReference={(job, output) => {
                upsertProductReference({ id: generateUUID(), assetId: output.assetId ?? output.url, projectId: projectId ?? undefined, sourceJobId: job.id, width: output.width, height: output.height, contentType: output.contentType, role: 'selected-concept', createdAt: Date.now() });
                addImageToWorkbench(output.url);
            }} />
        </aside>
    );
};
