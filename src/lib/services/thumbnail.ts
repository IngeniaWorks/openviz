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
