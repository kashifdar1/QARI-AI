import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { InMemoryContentRepository } from './contentRepository.js';
import { importTanzilContent } from './importCommand.js';
import { MVP_SURAH_NUMBERS, seedMvpPassages } from './mvpPassageSeed.js';

const TEXT_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-uthmani-v1.1.txt', import.meta.url),
);
const METADATA_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-quran-metadata-v1.0.xml', import.meta.url),
);

describe('MVP_SURAH_NUMBERS', () => {
  it('is Al-Fatihah plus An-Nas back through Ad-Duha — 23 surahs', () => {
    expect(MVP_SURAH_NUMBERS).toHaveLength(23);
    expect(MVP_SURAH_NUMBERS[0]).toBe(1);
    expect(MVP_SURAH_NUMBERS.slice(1)).toEqual(
      Array.from({ length: 22 }, (_, i) => 93 + i),
    );
  });
});

describe('seedMvpPassages', () => {
  it('creates one full-surah passage per MVP surah, with ayahEnd matching real Tanzil metadata', async () => {
    const repo = new InMemoryContentRepository();
    const { contentVersion } = await importTanzilContent(repo, TEXT_PATH, METADATA_PATH);

    const passages = await seedMvpPassages(repo, contentVersion.id, METADATA_PATH);

    expect(passages).toHaveLength(23);
    const fatiha = passages.find((p) => p.surahNumber === 1)!;
    expect(fatiha.ayahStart).toBe(1);
    expect(fatiha.ayahEnd).toBe(7);

    const nas = passages.find((p) => p.surahNumber === 114)!;
    expect(nas.ayahEnd).toBe(6);

    const duha = passages.find((p) => p.surahNumber === 93)!;
    expect(duha.ayahEnd).toBe(11);

    for (const passage of passages) {
      expect(passage.contentVersionId).toBe(contentVersion.id);
      expect(passage.riwayah).toBe('hafs_an_asim');
    }
  });

  it('every seeded passage\'s ayah range has real word data available (proves passages reference actually-imported text)', async () => {
    const repo = new InMemoryContentRepository();
    const { contentVersion } = await importTanzilContent(repo, TEXT_PATH, METADATA_PATH);
    const passages = await seedMvpPassages(repo, contentVersion.id, METADATA_PATH);

    for (const passage of passages) {
      for (let ayah = passage.ayahStart; ayah <= passage.ayahEnd; ayah++) {
        const words = await repo.getAyahWords(contentVersion.id, passage.surahNumber, ayah);
        expect(words.length).toBeGreaterThan(0);
      }
    }
  });
});
