import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPutAsset = vi.fn(async () => undefined);
const mockGetAssetBuffer = vi.fn();
vi.mock('@/lib/services/s3', () => ({
    putAsset: (...args: unknown[]) => mockPutAsset(...(args as [])),
    getAssetBuffer: (key: string) => mockGetAssetBuffer(key),
    isS3Configured: () => true,
    IMMUTABLE_CACHE_CONTROL: 'public, max-age=31536000, immutable',
    thumbnailKeyFor: (key: string) => {
        const dot = key.lastIndexOf('.');
        return dot === -1 ? null : `thumbnails/${key.slice(key.indexOf('/') + 1, dot)}.webp`;
    },
}));

const mockGenerateThumbnail = vi.fn();
vi.mock('@/lib/services/thumbnail', () => ({
    generateThumbnail: (input: Buffer, contentType: string) => mockGenerateThumbnail(input, contentType),
}));

vi.mock('@/lib/auth', () => ({
    auth: async () => ({ user: { id: 'user-1' } }),
}));

describe('POST /api/assets/thumbnail (Sprint 3 route)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetBuffer.mockResolvedValue(Buffer.from('fake-image-bytes'));
        mockGenerateThumbnail.mockResolvedValue({ buffer: Buffer.from('webp'), contentType: 'image/webp' });
    });

    const post = (key: string) =>
        import('./route').then(({ POST }) =>
            POST(new Request('http://localhost/api/assets/thumbnail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key }),
            }))
        );

    it('generates and stores the thumbnail, returning its app-relative ref', async () => {
        const res = await post('uploads/user-1/123-pic.png');
        const json = (await res.json()) as { thumbnailUrl: string | null };

        expect(res.status).toBe(200);
        expect(json.thumbnailUrl).toMatch(/^\/api\/assets\//);
        expect(mockPutAsset).toHaveBeenCalledWith(
            'thumbnails/user-1/123-pic.webp',
            Buffer.from('webp'),
            'image/webp',
            'public, max-age=31536000, immutable'
        );
    });

    it('returns null (never throws) when the source is not thumbnailable', async () => {
        mockGenerateThumbnail.mockResolvedValue(null);
        const res = await post('uploads/user-1/123-pic.png');
        const json = (await res.json()) as { thumbnailUrl: string | null; reason: string };

        expect(res.status).toBe(200);
        expect(json.thumbnailUrl).toBeNull();
        expect(json.reason).toBe('not-a-thumbnailable-image');
        expect(mockPutAsset).not.toHaveBeenCalled();
    });

    it('returns null when generation throws (S3 hiccup, corrupt bytes)', async () => {
        mockGetAssetBuffer.mockRejectedValue(new Error('S3 down'));
        const res = await post('uploads/user-1/123-pic.png');
        const json = (await res.json()) as { thumbnailUrl: string | null; reason: string };

        expect(res.status).toBe(200);
        expect(json.thumbnailUrl).toBeNull();
        expect(json.reason).toBe('generation-failed');
    });

    it('rejects keys outside the asset sections', async () => {
        const res = await post('secrets/user-1/123.png');
        const json = (await res.json()) as { thumbnailUrl: string | null };
        expect(json.thumbnailUrl).toBeNull();
        expect(mockGetAssetBuffer).not.toHaveBeenCalled();
    });

    it('forbids processing other users\' uploads', async () => {
        const res = await post('uploads/user-2/123-pic.png');
        expect(res.status).toBe(403);
        expect(mockGetAssetBuffer).not.toHaveBeenCalled();
    });

    it('rejects malformed JSON bodies with 400', async () => {
        const { POST } = await import('./route');
        const res = await POST(new Request('http://localhost/api/assets/thumbnail', { method: 'POST', body: '{nope' }));
        expect(res.status).toBe(400);
    });
});
