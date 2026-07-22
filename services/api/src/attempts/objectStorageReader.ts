import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { S3ObjectStorageConfig } from './objectStorage.js';

export type ObjectStorageReader = {
  readObjectBase64(objectKey: string): Promise<string>;
};

/** Real reader counterpart to S3ObjectStorage — used by the evaluation
 * worker to fetch the uploaded recording back out of the bucket. */
export class S3ObjectStorageReader implements ObjectStorageReader {
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

  async readObjectBase64(objectKey: string): Promise<string> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Object ${objectKey} had no body`);
    return Buffer.from(bytes).toString('base64');
  }
}

/** Test/dev default — serves base64 audio seeded in memory rather than a real bucket. */
export class FakeObjectStorageReader implements ObjectStorageReader {
  private objects = new Map<string, string>();

  seed(objectKey: string, base64: string): void {
    this.objects.set(objectKey, base64);
  }

  async readObjectBase64(objectKey: string): Promise<string> {
    const value = this.objects.get(objectKey);
    if (!value) throw new Error(`No fake object seeded for key ${objectKey}`);
    return value;
  }
}
