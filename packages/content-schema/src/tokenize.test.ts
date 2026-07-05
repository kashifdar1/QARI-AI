import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normalizeWord, tokenizeAyah } from './tokenize.js';

/**
 * Tests read the real, checksum-tracked Tanzil source file at runtime
 * rather than embedding Quranic Arabic as string literals in test code —
 * required by Principle 1 even in test fixtures (CLAUDE.md §1: "Test
 * fixtures use the imported versioned dataset").
 */
const SOURCE_PATH = fileURLToPath(
  new URL('../../../content-import/sources/tanzil-uthmani-v1.1.txt', import.meta.url),
);

function loadAyahText(sura: number, aya: number): string {
  const lines = readFileSync(SOURCE_PATH, 'utf-8').split('\n');
  const line = lines.find((l) => l.startsWith(`${sura}|${aya}|`));
  if (!line) throw new Error(`Ayah ${sura}:${aya} not found in source file`);
  const parts = line.split('|');
  return parts.slice(2).join('|').trim();
}

describe('tokenizeAyah — against real Tanzil source data', () => {
  it('splits Al-Fatihah 1:1 (Bismillah) into exactly 4 words', () => {
    const text = loadAyahText(1, 1);
    const tokens = tokenizeAyah(text);
    expect(tokens).toHaveLength(4);
    expect(tokens.map((t) => t.wordIndex)).toEqual([0, 1, 2, 3]);
    // Every token's displayText must be a verbatim substring of the source ayah.
    for (const token of tokens) {
      expect(text).toContain(token.displayText);
    }
  });

  it('preserves word order and count across a longer ayah (2:255, Ayat al-Kursi)', () => {
    const text = loadAyahText(2, 255);
    const tokens = tokenizeAyah(text);
    expect(tokens.length).toBeGreaterThan(30);
    // Rejoining display text with single spaces must losslessly reconstruct
    // the normalized-whitespace source (no words dropped or merged).
    expect(tokens.map((t) => t.displayText).join(' ')).toBe(text.trim().replace(/\s+/gu, ' '));
  });

  it('normalizedText is always shorter than or equal to displayText, and never empty for a non-empty word', () => {
    const text = loadAyahText(112, 1); // Al-Ikhlas 1
    for (const token of tokenizeAyah(text)) {
      expect(token.normalizedText.length).toBeLessThanOrEqual(token.displayText.length);
      expect(token.normalizedText.length).toBeGreaterThan(0);
    }
  });

  it('normalizeWord strips harakat but leaves consonant letters intact (checked against every word in An-Nas)', () => {
    const text = loadAyahText(114, 1);
    const tokens = tokenizeAyah(text);
    for (const token of tokens) {
      const normalized = normalizeWord(token.displayText);
      // Normalization only ever removes characters, never adds or reorders.
      expect(token.displayText.length).toBeGreaterThanOrEqual(normalized.length);
      // The base Arabic letters (U+0621-U+064A) that appear in displayText
      // must all still appear, in order, in normalizedText.
      const baseLetters = [...token.displayText].filter((ch) => {
        const code = ch.codePointAt(0)!;
        return code >= 0x0621 && code <= 0x064a;
      });
      const normalizedLetters = [...normalized].filter((ch) => {
        const code = ch.codePointAt(0)!;
        return code >= 0x0621 && code <= 0x064a;
      });
      expect(normalizedLetters).toEqual(baseLetters);
    }
  });

  it('returns an empty array for empty input', () => {
    expect(tokenizeAyah('')).toEqual([]);
    expect(tokenizeAyah('   ')).toEqual([]);
  });
});
