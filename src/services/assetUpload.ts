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

/**
 * Browser-side ≤512px WebP data-URL thumbnail (mock-mode fallback only).
 * Keeps `project.thumbnail` small when the asset store is unavailable, so
 * dashboard previews don't carry full-resolution base64. Returns null when
 * canvas APIs are missing or the image is already small.
 */
export async function makeThumbnailDataUrl(blob: Blob): Promise<string | null> {
    if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return null;
    try {
        const bitmap = await createImageBitmap(blob);
        const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
        if (scale >= 1) {
            bitmap.close();
            return null; // already at or below the budget
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            bitmap.close();
            return null;
        }
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
        if (!webp) return null;
        return blobToDataUrl(webp);
    } catch {
        return null; // undecodable image — no variant
    }
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
        // In mock mode the full-res base64 goes on the layer; a small WebP
        // variant (when we can make one) drives canvas/dashboard display so
        // previews don't ship full-resolution payloads.
        const dataUrl = await blobToDataUrl(blob);
        const thumbnailUrl = blob.type?.startsWith('image/') ? await makeThumbnailDataUrl(blob) : null;
        return { url: dataUrl, thumbnailUrl };
    }
}
