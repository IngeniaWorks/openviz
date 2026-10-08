import { blobToDataUrl } from '@/services/imageSource';
import { buildAssetUrl } from '@/lib/services/assetUrl';

/**
 * Upload an image/video blob to the S3-backed asset store and return a small,
 * durable reference URL (`/api/assets/<token>`) suitable for storing in node
 * state. The bytes live in S3; only the short ref is persisted/synced, which is
 * what keeps `/api/projects/[id]` responses and collab scene seeds small.
 *
 * Fallback: when the asset store is unavailable (e.g. local mock mode with no
 * S3 configured), this degrades to an inline base64 data URL so existing
 * behavior is preserved rather than breaking. Callers can treat the return value
 * as a plain image `src` in either case.
 */
export async function uploadBlobToAsset(blob: Blob, filename?: string): Promise<string> {
    const contentType = blob.type || 'application/octet-stream';

    try {
        const res = await fetch('/api/assets/upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: filename ?? 'asset', contentType }),
        });

        if (!res.ok) throw new Error(`upload-url request failed (${res.status})`);

        const { uploadUrl, key } = (await res.json()) as { uploadUrl: string; key: string };
        if (!uploadUrl || !key) throw new Error('upload-url response missing fields');

        const putRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': contentType },
            body: blob,
        });
        if (!putRes.ok) throw new Error(`asset upload failed (${putRes.status})`);

        return buildAssetUrl(key);
    } catch {
        // No asset store / network failure — keep the app working by inlining.
        return blobToDataUrl(blob);
    }
}
