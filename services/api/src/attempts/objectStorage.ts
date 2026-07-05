export type ObjectStorage = {
  objectExists(objectKey: string): Promise<boolean>;
  createSignedUploadUrl(objectKey: string, ttlSeconds: number): Promise<string>;
};

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
