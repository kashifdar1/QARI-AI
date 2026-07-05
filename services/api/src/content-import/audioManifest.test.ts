import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildAudioManifest } from './audioManifest.js';
import { InMemoryContentRepository } from './contentRepository.js';
import { importTanzilContent } from './importCommand.js';
import { MVP_SURAH_NUMBERS, seedMvpPassages } from './mvpPassageSeed.js';
import { InMemoryReciterAudioRepository } from './reciterAudioRepository.js';
import { seedPlaceholderReciterAudio } from './seedPlaceholderReciterAudio.js';

const TEXT_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-uthmani-v1.1.txt', import.meta.url),
);
const METADATA_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-quran-metadata-v1.0.xml', import.meta.url),
);

async function setUpFullPipeline() {
  const contentRepo = new InMemoryContentRepository();
  const reciterAudioRepo = new InMemoryReciterAudioRepository();
  const { contentVersion } = await importTanzilContent(contentRepo, TEXT_PATH, METADATA_PATH);
  const passages = await seedMvpPassages(contentRepo, contentVersion.id, METADATA_PATH);
  return { contentRepo, reciterAudioRepo, contentVersion, passages };
}

describe('buildAudioManifest — full pipeline (import -> passages -> placeholder audio -> manifest)', () => {
  it('reports ok with zero issues when every passage has placeholder audio and the object "exists"', async () => {
    const { contentRepo, reciterAudioRepo, passages } = await setUpFullPipeline();
    await seedPlaceholderReciterAudio(reciterAudioRepo, contentRepo, passages);
    const reciterAudio = await reciterAudioRepo.listByPassageIds(passages.map((p) => p.id));

    const report = await buildAudioManifest(passages, reciterAudio, async () => true);
    expect(report.ok).toBe(true);
    expect(report.checkedPassageCount).toBe(MVP_SURAH_NUMBERS.length);
    expect(report.issues).toEqual([]);
  });

  it('flags a passage with no ReciterAudio row at all', async () => {
    const { passages } = await setUpFullPipeline();
    // No audio seeded.
    const report = await buildAudioManifest(passages, [], async () => true);
    expect(report.ok).toBe(false);
    expect(report.issues).toHaveLength(passages.length);
    expect(report.issues[0]).toMatchObject({ kind: 'missing_audio_row' });
  });

  it('flags a passage whose audio row points at an object that does not exist in storage', async () => {
    const { contentRepo, reciterAudioRepo, passages } = await setUpFullPipeline();
    await seedPlaceholderReciterAudio(reciterAudioRepo, contentRepo, passages);
    const reciterAudio = await reciterAudioRepo.listByPassageIds(passages.map((p) => p.id));

    const report = await buildAudioManifest(passages, reciterAudio, async (key) => key !== reciterAudio[0]!.objectKey);
    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ kind: 'object_not_found', objectKey: reciterAudio[0]!.objectKey }),
    );
  });
});
