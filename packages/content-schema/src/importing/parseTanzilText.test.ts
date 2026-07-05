import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseTanzilText } from './parseTanzilText.js';

const SOURCE_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-uthmani-v1.1.txt', import.meta.url),
);

describe('parseTanzilText — against the real Tanzil source file', () => {
  it('parses exactly 6236 ayat with no unparseable data lines', () => {
    const raw = readFileSync(SOURCE_PATH, 'utf-8');
    const result = parseTanzilText(raw);
    expect(result.ayat).toHaveLength(6236);
    expect(result.unparseableLines).toEqual([]);
  });

  it('the first ayah is surah 1, ayah 1, and the last is surah 114, ayah 6', () => {
    const raw = readFileSync(SOURCE_PATH, 'utf-8');
    const { ayat } = parseTanzilText(raw);
    expect(ayat[0]).toMatchObject({ surahNumber: 1, ayahNumber: 1 });
    expect(ayat.at(-1)).toMatchObject({ surahNumber: 114, ayahNumber: 6 });
  });

  it('ignores comment and blank lines', () => {
    const result = parseTanzilText('# a comment\n\n1|1|placeholder text\n');
    expect(result.ayat).toEqual([{ surahNumber: 1, ayahNumber: 1, text: 'placeholder text' }]);
  });

  it('flags a genuinely malformed line as unparseable rather than silently dropping or guessing it', () => {
    const result = parseTanzilText('1|1|ok\nnot-a-valid-line\n2|1|also ok\n');
    expect(result.ayat).toHaveLength(2);
    expect(result.unparseableLines).toEqual([{ lineNumber: 2, content: 'not-a-valid-line' }]);
  });
});
