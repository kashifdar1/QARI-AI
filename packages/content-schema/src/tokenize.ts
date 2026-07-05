/**
 * Word tokenization for a single ayah's Uthmani text. Rules documented in
 * docs/content-tokenization.md — this module is the only implementation of
 * them; the forced-alignment pipeline (Milestone C) and any future
 * tokenization consumer must import this rather than re-splitting text
 * themselves, so the word-index numbering used by WordSegment/IssueCandidate
 * rows is defined in exactly one place.
 */

export type WordToken = {
  /** 0-based position of this word within its ayah. */
  wordIndex: number;
  /** Verbatim Uthmani text for this word, diacritics and waqf/sajdah marks intact — this is what's rendered. */
  displayText: string;
  /** Diacritics/tatweel/pause-mark-stripped form — this is what forced alignment matches against, not displayText. */
  normalizedText: string;
};

/**
 * Unicode ranges stripped for `normalizedText` (written as \u{} escapes,
 * not literal characters, so the exact code points are auditable in a
 * diff without relying on font rendering):
 *  - U+0610-U+061A  Quranic honorific/annotation signs
 *  - U+064B-U+065F  tanween, harakat (fatha/damma/kasra/sukun/shadda etc.)
 *  - U+0670         superscript alef
 *  - U+06D6-U+06DC  small high marks used in recitation annotation
 *  - U+06DF-U+06E4  small high marks (sajdah-adjacent, round zero, etc.)
 *  - U+06E7-U+06E8  small high yeh / small high noon
 *  - U+06EA-U+06ED  empty/full stop, low meem, small low seen
 *  - U+0640         tatweel (elongation, purely typographic)
 * Deliberately NOT stripped: U+06DE (rub-el-hizb) — see
 * docs/content-tokenization.md for the full rationale table.
 */
const DIACRITIC_PATTERN =
  /[ؐ-ًؚ-ٰٟۖ-ۜ۟-ۤۧ-۪ۨ-ۭـ]/gu;

export function normalizeWord(displayText: string): string {
  return displayText.replace(DIACRITIC_PATTERN, '');
}

/**
 * Splits on Unicode whitespace — Tanzil's Uthmani export already
 * space-delimits words, including keeping sajdah (U+06E9) and rub-el-hizb
 * (U+06DE) signs attached to the word they follow rather than as separate
 * tokens (verified against the source file; see
 * docs/content-tokenization.md).
 */
export function tokenizeAyah(ayahText: string): WordToken[] {
  const trimmed = ayahText.trim();
  if (trimmed.length === 0) return [];
  return trimmed
    .split(/\s+/u)
    .map((displayText, wordIndex) => ({
      wordIndex,
      displayText,
      normalizedText: normalizeWord(displayText),
    }));
}
