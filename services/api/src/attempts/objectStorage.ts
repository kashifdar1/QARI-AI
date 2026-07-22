import { HeadObjectCommand, NotFound, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type ObjectStorage = {
  objectExists(objectKey: string): Promise<boolean>;
  createSignedUploadUrl(objectKey: string, ttlSeconds: number): Promise<string>;
};

export type S3ObjectStorageConfig = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/**
 * Real object storage (CLAUDE.md §3: "S3-compatible, private buckets,
 * short-lived signed URLs"). Talks to MinIO locally via the S3-compatible
 * API — forcePathStyle is required for MinIO (it doesn't support the
 * virtual-hosted-style bucket addressing AWS S3 defaults to).
 */
export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3ObjectStorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async objectExists(objectKey: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }));
      return true;
    } catch (err) {
      if (err instanceof NotFound) return false;
      if (err && typeof err === 'object' && '$metadata' in err) {
        const meta = (err as { $metadata?: { httpStatusCode?: number } }).$metadata;
        if (meta?.httpStatusCode === 404) return false;
      }
      throw err;
    }
  }

  async createSignedUploadUrl(objectKey: string, ttlSeconds: number): Promise<string> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: objectKey });
    return getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
  }
}

/** Test/dev default — no real bucket involved. */
export class FakeObjectStorage implements ObjectStorage {
  private existingKeys: Set<string>;

  constructor(existingKeys: string[] = []) {
    this.existingKeys = new Set(existingKeys);
  }

  markExists(objectKey: string): void {
    this.existingKeys.add(objectKey);
  }

  async objectExists(objectKey: string): Promise<boolean> {
    return this.existingKeys.has(objectKey);
  }

  async createSignedUploadUrl(objectKey: string, ttlSeconds: number): Promise<string> {
    return `https://fake-storage.example.com/${objectKey}?ttl=${ttlSeconds}`;
  }
}
