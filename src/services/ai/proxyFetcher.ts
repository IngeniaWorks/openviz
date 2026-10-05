import { useStore } from '@/store/useStore';

/**
 * Client-side fetch wrapper that routes OpenAI-compatible endpoint traffic
 * through the authenticated /api/ai/proxy route. The server injects the
 * user's stored API key, so the key never needs to exist in the browser —
 * any device signed in to the account can generate (cross-device credentials).
 *
 * URLs outside the configured endpoint host (data: URLs, external image hosts,
 * relative ComfyUI paths) are fetched directly, preserving today's behavior.
 */

export type ProxyFetcher = typeof fetch;

/** Sentinel that satisfies targets' client-side "key required" guard while the proxy route supplies the real key server-side. Never reaches an upstream host: it is stripped before forwarding to /api/ai/proxy. */
export const PROXY_API_KEY = 'openviz-server-proxy';

function normalizeEndpoint(endpoint: string): string {
    return endpoint.trim().replace(/\/+$/, '');
}

export function createProxyFetcher(resolveEndpoint: () => string): ProxyFetcher {
    return (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (!/^https?:\/\//i.test(url)) return fetch(input, init);
        const root = normalizeEndpoint(resolveEndpoint());
        const isEndpointUrl = Boolean(root) && (url === root || url.startsWith(`${root}/`));
        if (!isEndpointUrl) return fetch(input, init);
        const rest = url.slice(root.length); // '' or '/models?limit=5'
        const sourceHeaders = init?.headers ?? (input instanceof Request ? input.headers : undefined);
        const headers = new Headers(sourceHeaders);
        headers.delete('Authorization');
        return fetch(`/api/ai/proxy${rest}`, { ...init, headers });
    };
}

/** Shared instance: resolves the active image endpoint from the store at call time, so a single instance serves every target. */
export const imageApiProxyFetcher: ProxyFetcher = createProxyFetcher(
    () => useStore.getState().computeSettings.imageApiEndpoint ?? '',
);
