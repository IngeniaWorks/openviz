import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
    generateThumbnail,
    downsampleDataUrlThumbnail,
    downsampleDataUrls,
    DATA_URL_DOWNSAMPLE_THRESHOLD,
    THUMBNAIL_MAX_DIM,
} from './thumbnail';

async function makePng(width: number, height: number): Promise<Buffer> {
    return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 60, b: 40 } } }).png().toBuffer();
}

/** Incompressible noise PNG — solid colors compress to a few KB and would sit
 * below the downsample threshold. */
async function makeNoisePng(width: number, height: number): Promise<Buffer> {
    const raw = Buffer.alloc(width * height * 3);
    for (let i = 0; i < raw.length; i += 1) raw[i] = Math.floor(Math.random() * 256);
    return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

describe('generateThumbnail (Sprint 3 server-side WebP pipeline)', () => {
    it('downscales a large PNG to WebP within the size budget', async () => {
        const input = await makePng(1600, 900);
        const result = await generateThumbnail(input, 'image/png');

        expect(result).not.toBeNull();
        const meta = await sharp(result!.buffer).metadata();
        expect(meta.format).toBe('webp');
        expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(THUMBNAIL_MAX_DIM);
        // Proportional downscale: 1600x900 -> 512x288 (fit inside, no enlargement)
        expect(meta.width).toBe(512);
        expect(meta.height).toBe(288);
        // The thumbnail must be smaller than the source.
        expect(result!.buffer.byteLength).toBeLessThan(input.byteLength);
    });

    it('returns null for images already at or below the budget (no point re-encoding)', async () => {
        const small = await makePng(300, 200);
        expect(await generateThumbnail(small, 'image/png')).toBeNull();
    });

    it('returns null for non-image content types', async () => {
        expect(await generateThumbnail(Buffer.from('not an image'), 'video/mp4')).toBeNull();
        expect(await generateThumbnail(Buffer.from('no ext type'), 'application/octet-stream')).toBeNull();
    });

    it('returns null (never throws) for undecodable bytes', async () => {
        await expect(generateThumbnail(Buffer.from('definitely not png bytes'), 'image/png')).resolves.toBeNull();
    });
});

describe('downsampleDataUrlThumbnail (shared mock-mode data-URL guard)', () => {
    it('passes short non-data refs through untouched (S3 mode)', async () => {
        expect(await downsampleDataUrlThumbnail('/api/assets/abc')).toBe('/api/assets/abc');
        expect(await downsampleDataUrlThumbnail('https://cdn.example/x.webp')).toBe('https://cdn.example/x.webp');
    });

    it('passes small data URLs through untouched (below the threshold)', async () => {
        const small = `data:image/png;base64,${'A'.repeat(100)}`;
        expect(await downsampleDataUrlThumbnail(small)).toBe(small);
    });

    it('downsamples an oversized decodable data URL to a webp data URL', async () => {
        const png = await makeNoisePng(1200, 800);
        const big = `data:image/png;base64,${png.toString('base64')}`;
        expect(big.length).toBeGreaterThan(DATA_URL_DOWNSAMPLE_THRESHOLD);

        const out = await downsampleDataUrlThumbnail(big);
        expect(out.startsWith('data:image/webp;base64,')).toBe(true);
        const meta = await sharp(Buffer.from(out.split(',')[1], 'base64')).metadata();
        expect(meta.format).toBe('webp');
        expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(THUMBNAIL_MAX_DIM);
    });

    it('returns the original for oversized but undecodable bytes (never throws)', async () => {
        const garbage = `data:image/png;base64,${'A'.repeat(DATA_URL_DOWNSAMPLE_THRESHOLD + 1)}`;
        expect(await downsampleDataUrlThumbnail(garbage)).toBe(garbage);
    });
});

describe('downsampleDataUrls (bounded-concurrency batch)', () => {
    it('mutates only oversized values in place', async () => {
        const png = await makeNoisePng(1200, 800);
        const big = `data:image/png;base64,${png.toString('base64')}`;
        const small = `data:image/png;base64,${'A'.repeat(100)}`;
        const items = [
            { value: big },
            { value: '/api/assets/ref' },
            { value: small },
        ];

        await downsampleDataUrls(items);

        expect(items[0].value.startsWith('data:image/webp')).toBe(true);
        expect(items[1].value).toBe('/api/assets/ref');
        expect(items[2].value).toBe(small);
    });
});
