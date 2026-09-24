import type {
    ProductWorkflowRequest,
    WorkflowValidationIssue,
    WorkflowValidationResult,
} from '@/types/productWorkflow.types';
import { getProductWorkflow } from './productWorkflowRegistry';

const MAX_BATCH_SIZE = 8;

export function validateProductWorkflowRequest(
    request: ProductWorkflowRequest
): WorkflowValidationResult {
    const issues: WorkflowValidationIssue[] = [];
    const workflow = getProductWorkflow(request.workflowId);

    if (!workflow) {
        issues.push({ field: 'workflowId', message: 'Unknown product workflow.', severity: 'error' });
        return { valid: false, issues };
    }

    if (!request.prompt.trim() && workflow.inputs.some((input) => input.kind === 'prompt' && input.required)) {
        issues.push({ field: 'prompt', message: 'A prompt is required for this workflow.', severity: 'error' });
    }

    if (workflow.inputs.some((input) => input.kind === 'reference' && input.required)) {
        const hasPrimaryReference = request.references.some((reference) => reference.role === 'primary');
        if (!hasPrimaryReference) {
            issues.push({ field: 'references', message: 'A primary reference image is required.', severity: 'error' });
        }
    }

    if (!Number.isInteger(request.width) || request.width <= 0) {
        issues.push({ field: 'width', message: 'Width must be a positive integer.', severity: 'error' });
    }

    if (!Number.isInteger(request.height) || request.height <= 0) {
        issues.push({ field: 'height', message: 'Height must be a positive integer.', severity: 'error' });
    }

    if (!Number.isInteger(request.batchSize) || request.batchSize < 1 || request.batchSize > MAX_BATCH_SIZE) {
        issues.push({ field: 'batchSize', message: `Batch size must be between 1 and ${MAX_BATCH_SIZE}.`, severity: 'error' });
    }

    if (request.maskAssetId && !workflow.capabilities.supportsMask) {
        issues.push({ field: 'maskAssetId', message: 'This workflow does not support masks.', severity: 'error' });
    }

    if (request.aspectRatio && !workflow.capabilities.supportsAspectRatios.includes(request.aspectRatio)) {
        issues.push({ field: 'aspectRatio', message: 'This aspect ratio is not supported by the selected workflow.', severity: 'error' });
    }

    return { valid: issues.every((issue) => issue.severity !== 'error'), issues };
}
