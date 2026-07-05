import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseQuranMetadata } from './parseQuranMetadata.js';

const METADATA_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-quran-metadata-v1.0.xml', import.meta.url),
);

describe('parseQuranMetadata — against the real Tanzil metadata file', () => {
  it('parses exactly 114 surahs, sorted by index, totalling 6236 ayat', () => {
    const xml = readFileSync(METADATA_PATH, 'utf-8');
    const surahs = parseQuranMetadata(xml);
    expect(surahs).toHaveLength(114);
    expect(surahs.map((s) => s.index)).toEqual(Array.from({ length: 114 }, (_, i) => i + 1));
    expect(surahs.reduce((sum, s) => sum + s.ayahCount, 0)).toBe(6236);
  });

  it('Al-Fatihah (surah 1) has 7 ayat and is Meccan', () => {
    const xml = readFileSync(METADATA_PATH, 'utf-8');
    const surahs = parseQuranMetadata(xml);
    const fatiha = surahs.find((s) => s.index === 1)!;
    expect(fatiha.ayahCount).toBe(7);
    expect(fatiha.revelationType).toBe('Meccan');
    expect(fatiha.nameTransliterated).toBe('Al-Faatiha');
  });

  it('An-Nas (surah 114) has 6 ayat', () => {
    const xml = readFileSync(METADATA_PATH, 'utf-8');
    const surahs = parseQuranMetadata(xml);
    expect(surahs.find((s) => s.index === 114)!.ayahCount).toBe(6);
  });
});
