import { parseQuranMetadata } from '@qari/content-schema';
import { readFile } from 'node:fs/promises';
import type { ContentRepository, NewPassage, PassageRecord } from './contentRepository.js';

/**
 * MVP passage set (Milestone B task 1): Al-Fatihah, plus Juz 'Amma's short
 * surahs An-Nas (114) back through Ad-Duha (93) — 23 surahs total, each as
 * one full-surah passage. Ayah ranges are computed from Tanzil's own
 * metadata (never hand-typed), so this list can never drift out of sync
 * with the actual imported ayah counts.
 */
export const MVP_SURAH_NUMBERS: readonly number[] = [
  1,
  ...Array.from({ length: 114 - 93 + 1 }, (_, i) => 93 + i), // 93..114
];

export async function seedMvpPassages(
  repo: ContentRepository,
  contentVersionId: string,
  metadataFilePath: string,
): Promise<PassageRecord[]> {
  const rawMetadata = await readFile(metadataFilePath, 'utf-8');
  const metadata = parseQuranMetadata(rawMetadata);
  const bySurah = new Map(metadata.map((s) => [s.index, s]));

  const created: PassageRecord[] = [];
  for (const surahNumber of MVP_SURAH_NUMBERS) {
    const surah = bySurah.get(surahNumber);
    if (!surah) {
      throw new Error(`No metadata found for surah ${surahNumber}`);
    }
    const newPassage: NewPassage = {
      contentVersionId,
      surahNumber,
      ayahStart: 1,
      ayahEnd: surah.ayahCount,
      riwayah: 'hafs_an_asim',
    };
    created.push(await repo.insertPassage(newPassage));
  }
  return created;
}
