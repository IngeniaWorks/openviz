import { auth } from '@/lib/auth';
import { buildAssetUrl } from '@/lib/services/assetUrl';
import { getAssetBuffer, IMMUTABLE_CACHE_CONTROL, isS3Configured, putAsset, thumbnailKeyFor } from '@/lib/services/s3';
import { generateThumbnail } from '@/lib/services/thumbnail';
import { NextResponse } from 'next/server';

/**
 * POST /api/assets/thumbnail  { key: string }
 *
 * Generates the WebP thumbnail variant for an uploaded asset (Sprint 3).
 * The client calls this right after its direct S3 PUT completes. The route is
 * deliberately forgiving: any failure (non-image, undecodable bytes, S3 hiccups)
 * yields `{ thumbnailUrl: null }` so uploads never break over a missing variant.
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isS3Configured()) {
        return NextResponse.json({ thumbnailUrl: null, reason: 'asset-store-unavailable' });
    }

    let body: { key?: string };
    try {
        body = (await req.json()) as { key?: string };
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const key = body.key;
    if (!key || !/^(uploads|renders)\//u.test(key)) {
        return NextResponse.json({ thumbnailUrl: null, reason: 'unsupported-key' });
    }
    // Only the owning user's uploads may be processed (keys embed the user id).
    if (key.startsWith('uploads/') && !key.startsWith(`uploads/${session.user.id}/`)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const thumbKey = thumbnailKeyFor(key);
    if (!thumbKey) return NextResponse.json({ thumbnailUrl: null, reason: 'unsupported-key' });

    try {
        const source = await getAssetBuffer(key);
        const contentType = guessContentType(key);
        const thumbnail = await generateThumbnail(source, contentType);
        if (!thumbnail) {
            return NextResponse.json({ thumbnailUrl: null, reason: 'not-a-thumbnailable-image' });
        }

        await putAsset(thumbKey, thumbnail.buffer, thumbnail.contentType, IMMUTABLE_CACHE_CONTROL);
        return NextResponse.json({ thumbnailUrl: buildAssetUrl(thumbKey) });
    } catch {
        // Never fail the upload over a missing thumbnail.
        return NextResponse.json({ thumbnailUrl: null, reason: 'generation-failed' });
    }
}

function guessContentType(key: string): string {
    const ext = key.toLowerCase().slice(key.lastIndexOf('.') + 1);
    switch (ext) {
        case 'png':
            return 'image/png';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'webp':
            return 'image/webp';
        case 'gif':
            return 'image/gif';
        case 'avif':
            return 'image/avif';
        default:
            return 'application/octet-stream';
    }
}
