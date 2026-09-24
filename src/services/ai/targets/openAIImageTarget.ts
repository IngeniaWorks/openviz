import type {
    ExecutionTargetAdapter,
    GenerationOutput,
    NormalizedJobStatus,
    PreflightResult,
    SubmittedJob,
    TargetCapabilities,
    TargetHealth,
} from '@/types/executionTarget.types';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';

type Fetcher = typeof fetch;
type JsonRecord = Record<string, unknown>;

export interface OpenAIImageTargetOptions {
    id: string;
    endpoint: string;
    model: string;
    apiKey?: string;
    keyless?: boolean;
    size?: string;
    fetcher?: Fetcher;
}

function asRecord(value: unknown): JsonRecord {
    return typeof value === 'object' && value !== null ? value as JsonRecord : {};
}

function normalizeEndpoint(endpoint: string): string {
    return endpoint.trim().replace(/\/$/, '');
}

async function readJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return { error: text };
    }
}

function errorMessage(body: unknown, fallback: string): string {
    const record = asRecord(body);
    const nested = asRecord(record.error);
    if (typeof nested.message === 'string') return nested.message;
    if (typeof record.error === 'string') return record.error;
    if (typeof record.message === 'string') return record.message;
    return fallback;
}

function authorizationHeader(options: OpenAIImageTargetOptions): string | undefined {
    if (options.keyless) return undefined;
    if (!options.apiKey?.trim()) throw new Error('An API key is required unless keyless API access is enabled.');
    return `Bearer ${options.apiKey.trim()}`;
}

function headers(options: OpenAIImageTargetOptions, includeJson = false): HeadersInit {
    const authorization = authorizationHeader(options);
    return {
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
    };
}

function parseModels(body: unknown): string[] {
    const record = asRecord(body);
    const data = Array.isArray(record.data) ? record.data : [];
    return data.flatMap((entry) => {
        if (typeof entry === 'string') return [entry];
        const model = asRecord(entry);
        return typeof model.id === 'string' ? [model.id] : [];
    });
}

function parseImageOutputs(body: unknown): GenerationOutput[] {
    const data = asRecord(body).data;
    if (!Array.isArray(data)) return [];
    return data.flatMap((entry, index) => {
        const record = asRecord(entry);
        if (typeof record.url !== 'string' || !/^https?:\/\//.test(record.url)) return [];
        return [{ url: record.url, index, contentType: 'image/*' }];
    });
}

export function createOpenAIImageTarget(options: OpenAIImageTargetOptions): ExecutionTargetAdapter {
    const endpoint = normalizeEndpoint(options.endpoint);
    const fetcher = options.fetcher ?? fetch;
    let cachedModels: string[] = [];
    let cachedOutputs: GenerationOutput[] = [];

    async function listModels(): Promise<string[]> {
        const response = await fetcher(`${endpoint}/models`, { headers: headers(options) });
        const body = await readJson(response);
        if (!response.ok) {
            const suffix = response.status === 401 || response.status === 403 ? ' Check the API key and Authorization header.' : '';
            throw new Error(`${errorMessage(body, `Model discovery failed (${response.status}).`)}${suffix}`);
        }
        cachedModels = parseModels(body);
        if (cachedModels.length === 0) throw new Error('The image API returned no usable models.');
        return cachedModels;
    }

    return {
        async health(): Promise<TargetHealth> {
            try {
                const models = await listModels();
                return { targetId: options.id, status: 'ready', capabilities: await this.capabilities(), message: models.join(', ') };
            } catch (error) {
                return {
                    targetId: options.id,
                    status: error instanceof Error && /401|403|API key|Authorization/i.test(error.message) ? 'auth-required' : 'unavailable',
                    message: error instanceof Error ? error.message : 'Image API is unavailable.',
                    capabilities: null,
                };
            }
        },

        async capabilities(): Promise<TargetCapabilities> {
            return {
                checkedAt: Date.now(),
                devices: [],
                customNodes: [],
                availableModels: cachedModels,
                availableNodeTypes: [],
                supportedPrecisions: [],
                supportedWorkflows: ['image-generation'],
            };
        },

        async preflight(request: ProductWorkflowRequest): Promise<PreflightResult> {
            if (!options.model.trim()) {
                return { ready: false, status: 'incompatible', issues: [{ code: 'missing-model', message: 'Select an image API model before generating.' }] };
            }
            if (!request.prompt.trim()) {
                return { ready: false, status: 'incompatible', issues: [{ code: 'missing-prompt', message: 'Enter a prompt before generating.' }] };
            }
            return { ready: true, status: 'ready', issues: [], selectedTier: 'hosted-auto', explanation: 'Synchronous OpenAI-compatible image generation.' };
        },

        async submit(request: ProductWorkflowRequest): Promise<SubmittedJob> {
            const response = await fetcher(`${endpoint}/images/generations`, {
                method: 'POST',
                headers: headers(options, true),
                body: JSON.stringify({
                    model: options.model,
                    prompt: request.prompt,
                    size: options.size ?? `${request.width}x${request.height}`,
                }),
            });
            const body = await readJson(response);
            if (!response.ok) {
                const suffix = response.status === 401 || response.status === 403 ? ' Check the API key and Authorization header.' : '';
                throw new Error(`${errorMessage(body, `Image generation failed (${response.status}).`)}${suffix}`);
            }
            cachedOutputs = parseImageOutputs(body);
            if (cachedOutputs.length === 0) throw new Error('The image API returned no usable image URLs.');
            return { jobId: `image-api-${Date.now()}`, targetId: options.id };
        },

        async getStatus(jobId: string): Promise<NormalizedJobStatus> {
            return { jobId, status: cachedOutputs.length > 0 ? 'completed' : 'failed', progress: cachedOutputs.length > 0 ? 100 : 0 };
        },

        async cancel(): Promise<void> {
            // The synchronous image API has no cancellation endpoint.
        },

        async getOutputs(): Promise<GenerationOutput[]> {
            return cachedOutputs;
        },
    };
}

export { parseModels, parseImageOutputs };
