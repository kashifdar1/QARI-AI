import type { SurahMetadata } from '../surah.js';
import type { ParsedAyah } from './parseTanzilText.js';

export type StructuralMismatch = {
  surahNumber: number;
  expectedAyahCount: number;
  actualAyahCount: number;
};

export type VerificationResult = {
  valid: boolean;
  totalAyahCount: number;
  mismatches: StructuralMismatch[];
};

/**
 * The importer's actual integrity check (see
 * content-import/sources/PROVENANCE.md for why this replaces a bare
 * checksum comparison): every surah's ayah count in the parsed text must
 * exactly match Tanzil's own independently-published metadata, and there
 * must be exactly 114 surahs represented.
 */
export function verifyStructure(ayat: ParsedAyah[], metadata: SurahMetadata[]): VerificationResult {
  const actualCounts = new Map<number, number>();
  for (const ayah of ayat) {
    actualCounts.set(ayah.surahNumber, Math.max(actualCounts.get(ayah.surahNumber) ?? 0, ayah.ayahNumber));
  }

  const mismatches: StructuralMismatch[] = [];
  for (const surah of metadata) {
    const actual = actualCounts.get(surah.index) ?? 0;
    if (actual !== surah.ayahCount) {
      mismatches.push({
        surahNumber: surah.index,
        expectedAyahCount: surah.ayahCount,
        actualAyahCount: actual,
      });
    }
  }

  const expectedSurahNumbers = new Set(metadata.map((s) => s.index));
  for (const surahNumber of actualCounts.keys()) {
    if (!expectedSurahNumbers.has(surahNumber)) {
      mismatches.push({
        surahNumber,
        expectedAyahCount: 0,
        actualAyahCount: actualCounts.get(surahNumber)!,
      });
    }
  }

  return {
    valid: mismatches.length === 0,
    totalAyahCount: ayat.length,
    mismatches,
  };
}
