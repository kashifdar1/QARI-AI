import { HeadObjectCommand, NotFound, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type ObjectStorage = {
  objectExists(objectKey: string): Promise<boolean>;
  createSignedUploadUrl(objectKey: string, ttlSeconds: number): Promise<string>;
};

export type S3ObjectStorageConfig = {
  endpoint: string;
  /** Host baked into presigned URLs handed back to clients. Defaults to
   * `endpoint` — only pass this separately when the server and the client
   * making the actual HTTP request can't reach the bucket at the same
   * address (see OBJECT_STORAGE_PUBLIC_ENDPOINT in packages/config). */
  publicEndpoint?: string;
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
  /** Presigning is a local, offline signature computation (no network call),
   * so a second client that only ever differs by `endpoint` is safe and is
   * the standard way to make the AWS SDK v3 presigner emit a different host
   * than the one the server itself talks to. */
  private readonly presignClient: S3Client;
  private readonly bucket: string;

  constructor(config: S3ObjectStorageConfig) {
    this.bucket = config.bucket;
    const credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials,
    });
    this.presignClient = config.publicEndpoint
      ? new S3Client({
          endpoint: config.publicEndpoint,
          region: 'us-east-1',
          forcePathStyle: true,
          credentials,
        })
      : this.client;
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
    return getSignedUrl(this.presignClient, command, { expiresIn: ttlSeconds });
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
