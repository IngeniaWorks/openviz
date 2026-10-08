import { blobToDataUrl } from '@/services/imageSource';
import { buildAssetUrl } from '@/lib/services/assetUrl';

/** Cache policy matching the server-signed upload URL (see s3.ts). */
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export interface UploadedAsset {
    /** Durable reference for full-resolution use (`/api/assets/<token>` or data-URL fallback). */
    url: string;
    /** Small WebP variant for canvas/dashboard display; `null` when unavailable (non-image, mock mode, generation failure). */
    thumbnailUrl: string | null;
}

async function requestThumbnail(key: string): Promise<string | null> {
    try {
        const res = await fetch('/api/assets/thumbnail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: JSON.stringify({ key }),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { thumbnailUrl?: string | null };
        return json.thumbnailUrl ?? null;
    } catch {
        return null; // thumbnails are a progressive enhancement, never blocking
    }
}

/**
 * Upload an image/video blob to the S3-backed asset store and return durable
 * reference URLs suitable for storing in node state. The bytes live in S3;
 * only the short refs are persisted/synced, which keeps `/api/projects/[id]`
 * responses and collab scene seeds small.
 *
 * Image uploads additionally generate a ≤512px WebP thumbnail server-side
 * (Sprint 3) so canvas + dashboard previews don't download full resolution.
 *
 * Fallback: when the asset store is unavailable (e.g. local mock mode with no
 * S3 configured), this degrades to an inline base64 data URL so existing
 * behavior is preserved rather than breaking. Callers can treat `url` as a
 * plain image `src` in either case.
 */
export async function uploadBlobToAsset(blob: Blob, filename?: string): Promise<UploadedAsset> {
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

        // Cache-Control is signed into the presigned URL — S3 stores it as
        // object metadata so browsers cache the bytes forever (immutable).
        const putRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': contentType, 'Cache-Control': IMMUTABLE_CACHE_CONTROL },
            body: blob,
        });
        if (!putRes.ok) throw new Error(`asset upload failed (${putRes.status})`);

        const url = buildAssetUrl(key);
        const thumbnailUrl = contentType.startsWith('image/') ? await requestThumbnail(key) : null;
        return { url, thumbnailUrl };
    } catch {
        // No asset store / network failure — keep the app working by inlining.
        const dataUrl = await blobToDataUrl(blob);
        return { url: dataUrl, thumbnailUrl: null };
    }
}
