/**
 * Server-side image thumbnailing (Sprint 3).
 *
 * Produces a small WebP variant (longest side <= {@link THUMBNAIL_MAX_DIM}px)
 * for canvas/dashboard display so full-resolution bytes are only fetched when
 * actually needed. Runs in the Node runtime (sharp is native); callers must
 * degrade gracefully when it returns null (non-image, decode failure).
 */

export const THUMBNAIL_MAX_DIM = 512;
export const THUMBNAIL_WEBP_QUALITY = 82;

export interface ThumbnailResult {
    buffer: Buffer;
    contentType: string;
}

/**
 * Downscale + re-encode an image buffer to WebP.
 *
 * Returns `null` (never throws) when the input is not a decodable image or is
 * already at or below the thumbnail size — in that case the original IS the
 * cheapest representation and no variant is worth storing.
 */
export async function generateThumbnail(
    input: Buffer | Uint8Array,
    contentType: string
): Promise<ThumbnailResult | null> {
    if (!contentType.startsWith('image/')) return null;

    const sharp = (await import('sharp')).default;
    let pipeline = sharp(Buffer.from(input));

    try {
        const meta = await pipeline.metadata();
        pipeline = sharp(Buffer.from(input)); // metadata() consumes the stream
        const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
        if (longest === 0 || longest <= THUMBNAIL_MAX_DIM) return null;

        const buffer = await pipeline
            .resize({ width: THUMBNAIL_MAX_DIM, height: THUMBNAIL_MAX_DIM, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: THUMBNAIL_WEBP_QUALITY })
            .toBuffer();

        return { buffer, contentType: 'image/webp' };
    } catch {
        // Undecodable bytes (corrupt upload, unsupported codec) — no thumbnail.
        return null;
    }
}

/**
 * Data-URL thumbnails above this size are full-resolution mock-mode base64
 * (S3 mode stores short /api/assets refs, which pass through untouched).
 * Shipping them to the browser makes list responses multi-MB and LCP
 * decode-bound — so they are downscaled server-side before responding.
 */
export const DATA_URL_DOWNSAMPLE_THRESHOLD = 65_536;

/**
 * Downscale an oversized data-URL thumbnail (mock mode) to a small WebP data
 * URL. Short refs (S3 mode) and already-small data URLs pass through
 * unchanged; undecodable bytes return the original rather than nothing.
 */
export async function downsampleDataUrlThumbnail(thumbnail: string): Promise<string> {
    if (!thumbnail.startsWith("data:image") || thumbnail.length <= DATA_URL_DOWNSAMPLE_THRESHOLD) {
        return thumbnail;
    }
    try {
        const comma = thumbnail.indexOf(",");
        const contentType = /data:([^;]+)/u.exec(thumbnail)?.[1] ?? "image/png";
        const result = await generateThumbnail(Buffer.from(thumbnail.slice(comma + 1), "base64"), contentType);
        if (!result) return thumbnail;
        return `data:${result.contentType};base64,${result.buffer.toString("base64")}`;
    } catch {
        return thumbnail; // undecodable — ship the original rather than nothing
    }
}

/** Run downsample with bounded concurrency (sharp decodes are CPU-heavy). */
export async function downsampleDataUrls(items: Array<{ value: string }>, limit = 8): Promise<void> {
    let cursor = 0;
    const worker = async () => {
        while (cursor < items.length) {
            const item = items[cursor++];
            item.value = await downsampleDataUrlThumbnail(item.value);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
