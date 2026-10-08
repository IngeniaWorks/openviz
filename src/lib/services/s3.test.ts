import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const ENV_KEYS = ['S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET'] as const;

describe('s3.isS3Configured', () => {
    const saved: Record<string, string | undefined> = {};

    beforeEach(() => {
        for (const key of ENV_KEYS) saved[key] = process.env[key];
        // Start from an unconfigured state.
        delete process.env.S3_ENDPOINT;
        delete process.env.S3_ACCESS_KEY_ID;
        delete process.env.S3_SECRET_ACCESS_KEY;
        delete process.env.S3_BUCKET;
    });

    afterEach(() => {
        for (const key of ENV_KEYS) {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
        }
    });

    it('is false when no S3 env vars are set (local mock mode)', async () => {
        const { isS3Configured } = await import('./s3');
        expect(isS3Configured()).toBe(false);
    });

    it('is true only when all four S3 env vars are present', async () => {
        process.env.S3_ENDPOINT = 'https://r2.example.com';
        process.env.S3_ACCESS_KEY_ID = 'id';
        process.env.S3_SECRET_ACCESS_KEY = 'secret';
        const { isS3Configured } = await import('./s3');
        expect(isS3Configured()).toBe(false); // missing bucket
        process.env.S3_BUCKET = 'bucket';
        expect(isS3Configured()).toBe(true);
    });

    it('imports without throwing when env vars are unset (lazy client)', async () => {
        // Importing the module must not construct a client / throw.
        await expect(import('./s3')).resolves.toMatchObject({ isS3Configured: expect.any(Function) });
    });
});
