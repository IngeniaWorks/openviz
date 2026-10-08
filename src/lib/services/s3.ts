import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Server-side upload of an object's bytes (used by migration/ops scripts that
 * already hold the data in-process). Browser code should use {@link getUploadUrl}
 * and PUT directly to the presigned URL instead.
 */
export async function putAsset(key: string, body: Uint8Array | Buffer, contentType: string) {
    await getClient().send(
        new PutObjectCommand({
            Bucket: BUCKET_NAME!,
            Key: key,
            Body: body,
            ContentType: contentType,
        }),
    );
}

/**
 * S3 storage is optional in local/mock mode. The client and bucket are read
 * lazily so that importing this module never throws when the env vars are not
 * set (e.g. a developer running without an S3/R2 backend). Callers should check
 * {@link isS3Configured} and fall back to inline base64 when it returns false.
 */
const BUCKET_NAME = process.env.S3_BUCKET;

let s3Client: S3Client | null = null;
function getClient(): S3Client {
    if (!s3Client) {
        s3Client = new S3Client({
            // Most S3-compatible backends (R2, Supabase) use "auto"; local
            // SeaweedFS and AWS expect a concrete region. Override with S3_REGION.
            region: process.env.S3_REGION || "auto",
            endpoint: process.env.S3_ENDPOINT!,
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID!,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
            },
            // SeaweedFS (and other local S3 servers) only accept path-style
            // addressing — virtual-hosted style returns 405. Required for the
            // presigned PUT/GET URLs minted by getUploadUrl/getDownloadUrl.
            forcePathStyle: true,
            // The default WHEN_SUPPORTED adds an x-amz-checksum-* header to
            // presigned uploads that SeaweedFS rejects (BadDigest). Only send a
            // checksum when the backend explicitly requires one.
            requestChecksumCalculation: "WHEN_REQUIRED",
        });
    }
    return s3Client;
}

/** True when the S3/R2 backend is configured and presigned URLs can be minted. */
export function isS3Configured(): boolean {
    return Boolean(
        process.env.S3_ENDPOINT &&
        process.env.S3_ACCESS_KEY_ID &&
        process.env.S3_SECRET_ACCESS_KEY &&
        process.env.S3_BUCKET,
    );
}

/**
 * Generates a pre-signed URL for uploading a file to S3.
 */
export async function getUploadUrl(key: string, contentType: string) {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME!,
        Key: key,
        ContentType: contentType,
    });

    return await getSignedUrl(getClient(), command, { expiresIn: 3600 });
}

/**
 * Generates a pre-signed URL for viewing/downloading an object.
 */
export async function getDownloadUrl(key: string) {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME!,
        Key: key,
    });

    return await getSignedUrl(getClient(), command, { expiresIn: 3600 * 24 }); // 24 hours
}

/**
 * Helper to construct the path for different asset types.
 */
export const s3Paths = {
    uploads: (userId: string, filename: string) => `uploads/${userId}/${filename}`,
    renders: (projectId: string, jobId: string, filename: string) => `renders/${projectId}/${jobId}/${filename}`,
    thumbnails: (projectId: string, filename: string) => `thumbnails/${projectId}/${filename}`,
};
