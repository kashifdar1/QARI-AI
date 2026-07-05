export type ObjectStorageReader = {
  readObjectBase64(objectKey: string): Promise<string>;
};

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
