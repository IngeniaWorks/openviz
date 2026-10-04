/**
 * OpenAI-compatible video generation target (Unsloth endpoint, R1).
 *
 * Feature 012 (T006b): routes Animate to the active protocol's video route.
 * When capability probing reports the native route, `POST
 * /api/inference/video/generate` starts a background job whose terminal
 * outcome arrives via `/api/inference/video/generate-progress`; otherwise
 * `POST /v1/videos` returns a `VideoJob` polled by id. Optional fields an
 * older endpoint rejects are dropped on a single retry (capability-tolerant,
 * R4). Runtime internals are never emitted (FR-002).
 */

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
import { blobToDataUrl } from '@/services/imageSource';
import { endpointRoot, normalizeInputImage } from './openAIImagePayload';

type Fetcher = typeof fetch;
type JsonRecord = Record<string, unknown>;

/** Optional native video fields that older endpoints may reject (R4). */
const NATIVE_VIDEO_OPTIONAL_FIELDS = ['negative_prompt', 'seed'] as const;

export interface OpenAIVideoTargetOptions {
    id: string;
    endpoint: string;
    model: string;
    apiKey?: string;
    keyless?: boolean;
    /** Capability probe result: the native /api/inference/video/generate route exists (R1). */
    nativeVideoRoute?: boolean;
    fetcher?: Fetcher;
}

interface NativeVideoJob {
    protocol: 'native';
    status: NormalizedJobStatus['status'];
    progress: number;
    message?: string;
    outputs: GenerationOutput[] | null;
}

interface OpenAIVideoJob {
    protocol: 'openai';
    videoId: string;
    status: NormalizedJobStatus['status'];
    progress: number;
    message?: string;
    outputs: GenerationOutput[] | null;
}

type VideoJobState = NativeVideoJob | OpenAIVideoJob;

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
    // FastAPI-style validation errors (400/422) surface in `detail`.
    if (typeof record.detail === 'string') return record.detail;
    return fallback;
}

function authorizationHeader(options: OpenAIVideoTargetOptions): string | undefined {
    if (options.keyless) return undefined;
    if (!options.apiKey?.trim()) throw new Error('An API key is required unless keyless API access is enabled.');
    return `Bearer ${options.apiKey.trim()}`;
}

function headers(options: OpenAIVideoTargetOptions, includeJson = false): HeadersInit {
    const authorization = authorizationHeader(options);
    return {
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
    };
}

function buildNativeVideoPayload(request: ProductWorkflowRequest, options: OpenAIVideoTargetOptions, droppedFields?: ReadonlySet<string>): Record<string, unknown> {
    const payload: Record<string, unknown> = { prompt: request.prompt };
    if (request.width > 0) payload.width = request.width;
    if (request.height > 0) payload.height = request.height;
    if (request.numFrames && request.numFrames > 0) payload.num_frames = request.numFrames;
    if (request.fps && request.fps > 0) payload.fps = request.fps;
    if (request.initImage) payload.first_frame = request.initImage;
    if (request.endImage) payload.last_frame = request.endImage;
    const optional: Array<[string, unknown]> = [
        ['negative_prompt', request.negativePrompt],
        ['seed', request.seed],
    ];
    for (const [key, value] of optional) {
        if (value !== undefined && !droppedFields?.has(key)) payload[key] = value;
    }
    return payload;
}

function buildOpenAIVideoPayload(request: ProductWorkflowRequest, options: OpenAIVideoTargetOptions): Record<string, unknown> {
    const payload: Record<string, unknown> = { model: options.model, prompt: request.prompt };
    if (request.width > 0 && request.height > 0) payload.size = `${request.width}x${request.height}`;
    if (request.numFrames && request.fps && request.fps > 0) {
        const seconds = Math.round((request.numFrames / request.fps) * 10) / 10;
        if (seconds > 0) payload.seconds = String(seconds);
    }
    return payload;
}

async function materializeVideoOutput(url: string, options: OpenAIVideoTargetOptions, fetcher: Fetcher): Promise<GenerationOutput> {
    const absolute = /^https?:\/\//.test(url) ? url : `${endpointRoot(options.endpoint)}${url.startsWith('/') ? '' : '/'}${url}`;
    const response = await fetcher(absolute, { headers: headers(options) });
    if (!response.ok) throw new Error(`Rendered video download failed (${response.status}).`);
    const contentType = response.headers.get('content-type')?.split(';')[0] ?? 'video/mp4';
    return { url: await blobToDataUrl(await response.blob()), index: 0, contentType };
}

export function createOpenAIVideoTarget(options: OpenAIVideoTargetOptions): ExecutionTargetAdapter {
    const endpoint = normalizeEndpoint(options.endpoint);
    const fetcher = options.fetcher ?? fetch;
    let cachedModels: string[] = [];
    const jobs = new Map<string, VideoJobState>();

    async function listModels(): Promise<void> {
        const response = await fetcher(`${endpoint}/models`, { headers: headers(options) });
        const body = asRecord(await readJson(response));
        if (!response.ok) {
            const suffix = response.status === 401 || response.status === 403 ? ' Check the API key and Authorization header.' : '';
            throw new Error(`${errorMessage(body, `Model discovery failed (${response.status}).`)}${suffix}`);
        }
        const data = Array.isArray(body.data) ? body.data : [];
        cachedModels = data.map((item) => asRecord(item).id).filter((id): id is string => typeof id === 'string');
        if (cachedModels.length === 0) throw new Error('The video API returned no usable models.');
    }

    async function postJson(url: string, payload: Record<string, unknown>): Promise<Response> {
        return fetcher(url, { method: 'POST', headers: headers(options, true), body: JSON.stringify(payload) });
    }

    /** One best-effort progress check; never throws (SC-009 parity). */
    async function pollNativeOnce(state: NativeVideoJob): Promise<void> {
        try {
            const response = await fetcher(`${endpointRoot(endpoint)}/api/inference/video/generate-progress`, { headers: headers(options) });
            if (!response.ok) return;
            const body = asRecord(await readJson(response));
            const phase = typeof body.phase === 'string' ? body.phase : null;
            if (phase === 'completed') {
                state.status = 'completed';
                state.progress = 100;
                const video = asRecord(body.video);
                if (typeof video.url === 'string' && video.url.length > 0) {
                    state.outputs = [await materializeVideoOutput(video.url, options, fetcher)];
                } else {
                    state.outputs = [];
                }
            } else if (phase === 'failed') {
                state.status = 'failed';
                state.message = typeof body.error === 'string' ? body.error : 'The video generation failed.';
            } else if (state.status !== 'cancelled') {
                const fraction = typeof body.fraction === 'number' && Number.isFinite(body.fraction) ? Math.min(1, Math.max(0, body.fraction)) : null;
                state.status = 'running';
                state.progress = fraction === null ? state.progress : Math.round(fraction * 100);
            }
        } catch {
            // Best effort: progress telemetry must never break the generation.
        }
    }

    async function pollOpenAIOnce(state: OpenAIVideoJob): Promise<void> {
        try {
            const response = await fetcher(`${endpoint}/videos/${state.videoId}`, { headers: headers(options) });
            if (!response.ok) return;
            const job = asRecord(await readJson(response));
            if (job.status === 'completed') {
                state.status = 'completed';
                state.progress = 100;
                const contentUrl = `${endpoint}/videos/${state.videoId}/content`;
                state.outputs = [await materializeVideoOutput(contentUrl, options, fetcher)];
            } else if (job.status === 'failed') {
                state.status = 'failed';
                const error = asRecord(job.error);
                state.message = typeof error.message === 'string' ? error.message : 'The video generation failed.';
            } else {
                state.status = job.status === 'queued' ? 'queued' : 'running';
                if (typeof job.progress === 'number') state.progress = Math.min(100, Math.max(0, Math.round(job.progress)));
            }
        } catch {
            // Best effort: keep the last known status.
        }
    }

    return {
        async health(): Promise<TargetHealth> {
            try {
                await listModels();
                return { targetId: options.id, status: 'ready', capabilities: await this.capabilities(), message: cachedModels.join(', ') };
            } catch (error) {
                return {
                    targetId: options.id,
                    status: error instanceof Error && /401|403|API key|Authorization/i.test(error.message) ? 'auth-required' : 'unavailable',
                    message: error instanceof Error ? error.message : 'Video API is unavailable.',
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
                supportedWorkflows: ['video-generation'],
            };
        },

        async preflight(request: ProductWorkflowRequest): Promise<PreflightResult> {
            const issues: PreflightResult['issues'] = [];
            if (!options.model.trim()) issues.push({ code: 'missing-model', message: 'Select a video model before generating.' });
            if (!request.prompt.trim()) issues.push({ code: 'missing-prompt', message: 'Describe the motion before animating.' });
            // FR-017: a connected start frame is required.
            if (!request.initImage?.trim()) issues.push({ code: 'missing-start-frame', message: 'Connect a start frame before animating.' });
            if (issues.length > 0) return { ready: false, status: 'incompatible', issues };
            return { ready: true, status: 'ready', issues: [], selectedTier: 'hosted-auto', explanation: options.nativeVideoRoute ? 'Native Unsloth video route.' : 'OpenAI-compatible video job.' };
        },

        async submit(request: ProductWorkflowRequest): Promise<SubmittedJob> {
            const initImage = await normalizeInputImage(request.initImage, fetcher);
            const endImage = await normalizeInputImage(request.endImage, fetcher);
            if (!initImage) throw new Error('A start frame is required for animation.');

            let state: VideoJobState;
            if (options.nativeVideoRoute) {
                const nativeRequest: ProductWorkflowRequest = {
                    ...request,
                    initImage,
                    ...(endImage ? { endImage } : {}),
                };
                const payload = buildNativeVideoPayload(nativeRequest, options);
                let response = await postJson(`${endpointRoot(endpoint)}/api/inference/video/generate`, payload);
                if (!response.ok && (response.status === 400 || response.status === 422)) {
                    // Capability-tolerant retry: drop the optional fields an older endpoint may not support (R4).
                    response = await postJson(`${endpointRoot(endpoint)}/api/inference/video/generate`, buildNativeVideoPayload(nativeRequest, options, new Set(NATIVE_VIDEO_OPTIONAL_FIELDS)));
                }
                const body = await readJson(response);
                if (!response.ok) {
                    const suffix = response.status === 401 || response.status === 403 ? ' Check the API key and Authorization header.' : '';
                    throw new Error(`${errorMessage(body, `Video generation failed (${response.status}).`)}${suffix}`);
                }
                state = { protocol: 'native', status: 'queued', progress: 0, outputs: null };
                await pollNativeOnce(state); // seed the first reading; best effort
            } else {
                const response = await postJson(`${endpoint}/videos`, buildOpenAIVideoPayload(request, options));
                const body = asRecord(await readJson(response));
                if (!response.ok) {
                    const suffix = response.status === 401 || response.status === 403 ? ' Check the API key and Authorization header.' : '';
                    throw new Error(`${errorMessage(body, `Video generation failed (${response.status}).`)}${suffix}`);
                }
                if (typeof body.id !== 'string' || body.id.length === 0) throw new Error('The video API returned no job id.');
                state = { protocol: 'openai', videoId: body.id, status: typeof body.status === 'string' ? (body.status as OpenAIVideoJob['status']) : 'queued', progress: 0, outputs: null };
            }

            const jobId = `video-${Date.now()}`;
            jobs.set(jobId, state);
            return { jobId, targetId: options.id };
        },

        async getStatus(jobId: string): Promise<NormalizedJobStatus> {
            const state = jobs.get(jobId);
            if (!state) return { jobId, status: 'failed', progress: 0, message: `Unknown video job ${jobId}.` };
            if (state.status !== 'completed' && state.status !== 'failed' && state.status !== 'cancelled') {
                if (state.protocol === 'native') await pollNativeOnce(state);
                else await pollOpenAIOnce(state);
            }
            return { jobId, status: state.status, progress: state.progress, ...(state.message ? { message: state.message } : {}) };
        },

        async cancel(jobId: string): Promise<void> {
            const state = jobs.get(jobId);
            if (!state || state.protocol !== 'native' || state.status === 'completed' || state.status === 'failed') return;
            try {
                await fetcher(`${endpointRoot(endpoint)}/api/inference/video/generate/cancel`, { method: 'POST', headers: headers(options, true), body: '{}' });
            } catch {
                // Best effort: some endpoints have no live job to cancel.
            }
            state.status = 'cancelled';
        },

        async getOutputs(jobId: string): Promise<GenerationOutput[]> {
            const state = jobs.get(jobId);
            if (!state || state.outputs === null) return [];
            return state.outputs;
        },
    };
}
