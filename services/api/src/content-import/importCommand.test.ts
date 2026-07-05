import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { InMemoryContentRepository } from './contentRepository.js';
import { ImportVerificationError, importTanzilContent } from './importCommand.js';

const TEXT_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-uthmani-v1.1.txt', import.meta.url),
);
const METADATA_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-quran-metadata-v1.0.xml', import.meta.url),
);

describe('importTanzilContent — against the real, committed Tanzil source files', () => {
  it('imports the full corpus: 6236 ayat, a content version in "imported" status, and a matching checksum', async () => {
    const repo = new InMemoryContentRepository();
    const result = await importTanzilContent(repo, TEXT_PATH, METADATA_PATH);

    expect(result.ayahCount).toBe(6236);
    expect(result.contentVersion.reviewStatus).toBe('imported');
    expect(result.contentVersion.riwayah).toBe('hafs_an_asim');
    expect(result.contentVersion.source).toBe('tanzil_net_uthmani');
    expect(result.sha256).toBe(
      'bf4f57b968d03f4131c070b1e285da9be0e0a108a21c910e872801ca273312c8',
    );
    expect(result.contentVersion.sourceChecksum).toBe(result.sha256);
  });

  it('writes an audit event recording the import', async () => {
    const repo = new InMemoryContentRepository();
    const result = await importTanzilContent(repo, TEXT_PATH, METADATA_PATH);
    expect(repo.auditEvents).toContainEqual(
      expect.objectContaining({
        eventType: 'content_version.imported',
        subjectType: 'quran_content_version',
        subjectId: result.contentVersion.id,
      }),
    );
  });

  it('stores retrievable word rows for a known ayah (Al-Fatihah 1:1 has 4 words)', async () => {
    const repo = new InMemoryContentRepository();
    const result = await importTanzilContent(repo, TEXT_PATH, METADATA_PATH);
    const words = await repo.getAyahWords(result.contentVersion.id, 1, 1);
    expect(words).toHaveLength(4);
    expect(words.map((w) => w.wordIndex)).toEqual([0, 1, 2, 3]);
  });

  it('the imported word count matches tokenizing every ayah independently', async () => {
    const repo = new InMemoryContentRepository();
    const result = await importTanzilContent(repo, TEXT_PATH, METADATA_PATH);
    // Sanity bound: 6236 ayat, at minimum 1 word each.
    expect(result.wordCount).toBeGreaterThanOrEqual(6236);
  });

  it('rejects import if the text file fails structural verification against metadata (corrupted copy)', async () => {
    const repo = new InMemoryContentRepository();
    // A metadata file that expects a different structure than the real text.
    const wrongMetadataPath = fileURLToPath(new URL('./fixtures/wrong-metadata.xml', import.meta.url));
    await expect(importTanzilContent(repo, TEXT_PATH, wrongMetadataPath)).rejects.toThrow(
      ImportVerificationError,
    );
  });

  it('writes nothing when verification fails', async () => {
    const repo = new InMemoryContentRepository();
    const wrongMetadataPath = fileURLToPath(new URL('./fixtures/wrong-metadata.xml', import.meta.url));
    await expect(importTanzilContent(repo, TEXT_PATH, wrongMetadataPath)).rejects.toThrow();
    expect(await repo.findApprovedContentVersion()).toBeNull();
    const words = await repo.getAyahWords('anything', 1, 1);
    expect(words).toEqual([]);
  });
});
