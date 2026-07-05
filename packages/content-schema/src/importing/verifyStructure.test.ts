import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseQuranMetadata } from './parseQuranMetadata.js';
import { parseTanzilText } from './parseTanzilText.js';
import { verifyStructure } from './verifyStructure.js';

const TEXT_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-uthmani-v1.1.txt', import.meta.url),
);
const METADATA_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-quran-metadata-v1.0.xml', import.meta.url),
);

describe('verifyStructure — real Tanzil text cross-checked against real Tanzil metadata', () => {
  it('finds zero mismatches on the committed source files (this IS the import checksum-equivalent check)', () => {
    const { ayat } = parseTanzilText(readFileSync(TEXT_PATH, 'utf-8'));
    const metadata = parseQuranMetadata(readFileSync(METADATA_PATH, 'utf-8'));
    const result = verifyStructure(ayat, metadata);
    expect(result.valid).toBe(true);
    expect(result.totalAyahCount).toBe(6236);
    expect(result.mismatches).toEqual([]);
  });

  it('detects a missing ayah (simulated corruption)', () => {
    const { ayat } = parseTanzilText(readFileSync(TEXT_PATH, 'utf-8'));
    const metadata = parseQuranMetadata(readFileSync(METADATA_PATH, 'utf-8'));
    const corrupted = ayat.filter((a) => !(a.surahNumber === 1 && a.ayahNumber === 7));
    const result = verifyStructure(corrupted, metadata);
    expect(result.valid).toBe(false);
    expect(result.mismatches).toContainEqual({
      surahNumber: 1,
      expectedAyahCount: 7,
      actualAyahCount: 6,
    });
  });

  it('detects an unexpected extra surah number not present in metadata', () => {
    const { ayat } = parseTanzilText(readFileSync(TEXT_PATH, 'utf-8'));
    const metadata = parseQuranMetadata(readFileSync(METADATA_PATH, 'utf-8'));
    const corrupted = [...ayat, { surahNumber: 200, ayahNumber: 1, text: 'not real' }];
    const result = verifyStructure(corrupted, metadata);
    expect(result.valid).toBe(false);
    expect(result.mismatches).toContainEqual({
      surahNumber: 200,
      expectedAyahCount: 0,
      actualAyahCount: 1,
    });
  });
});
