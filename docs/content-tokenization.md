# Content tokenization

How Uthmani ayah text is split into words for storage (`WordSegment`
target text) and, later, forced-alignment matching (Milestone C). The only
implementation of these rules is `packages/content-schema/src/tokenize.ts`
(`tokenizeAyah`, `normalizeWord`) — nothing else may re-split ayah text.

## Splitting into words

Split on Unicode whitespace (`/\s+/u`). Tanzil's Uthmani export is already
word-space-delimited, including:

- **Sajdah sign (U+06E9 ۩)** and **rub-el-hizb sign (U+06DE ۞)**: verified
  against the source file to be attached to the word they follow (no
  leading/trailing space around the mark itself), so they ride along as
  part of that word's `displayText` rather than becoming their own token.
  This matters for word-count consistency between `displayText` tokens and
  audio timing segments — a stray extra "word" from a detached mark would
  throw off the 1:1 mapping to `WordSegment` rows.
- **Bismillah at the start of a surah** (all surahs except At-Tawbah): part
  of ayah 1's text as Tanzil provides it — tokenized as ordinary words like
  any other, no special-casing.

## `displayText` vs `normalizedText`

Every word token carries two forms:

| Field | Purpose | Content |
|---|---|---|
| `displayText` | What's rendered on screen | Verbatim from the source, diacritics and pause marks intact |
| `normalizedText` | What forced alignment matches against | Diacritics, tatweel, and small recitation-annotation marks stripped |

**Why two forms, not one:** the Uthmani script's diacritics (harakat,
tanween, superscript alef) and Quranic annotation marks (small high
marks used to guide recitation, waqf/pause indicators) are essential to
*display* — they're literally what "Uthmani script" means, distinct from
the "Simple" text variants — but they are not what an ASR model's output
should be diffed against word-for-word, since minor harakat-transcription
variance is not the kind of deviation the confidence-tier feedback policy
(ADR-005) is trying to detect (that's phonetic/word-level omission,
repetition, substitution — not diacritic-rendering fidelity).

## Characters stripped for `normalizedText`

| Range | What it is |
|---|---|
| U+0610–U+061A | Quranic honorific/annotation signs |
| U+064B–U+065F | Tanween, harakat (fatha, damma, kasra, sukun, shadda, etc.) |
| U+0670 | Superscript alef |
| U+06D6–U+06DC | Small high marks used in recitation annotation |
| U+06DF–U+06E4 | Small high marks (round zero, small high seen, etc.) |
| U+06E7–U+06E8 | Small high yeh / small high noon |
| U+06EA–U+06ED | Empty/full stop marks, small low seen, low meem |
| U+0640 | Tatweel (purely typographic elongation, never phonetic) |

**Deliberately not stripped:** U+06DE (rub-el-hizb ۞) — when it's attached
to a word rather than standing alone, stripping it doesn't change the word
boundary, but it's excluded from the strip set on principle: it's a
structural/navigational mark (marks a rub-el-hizb boundary), not a
recitation-pronunciation mark, so it's out of scope for "what should
alignment ignore" even though in practice it never survives into
`normalizedText` matching anyway since it doesn't appear inside a word's
letters.

## Waqf (pause) marks

Waqf marks (e.g., mandatory/permissible/prohibited pause indicators) fall
within the U+06D6–U+06DC "small high mark" range above and are stripped
from `normalizedText` for the same reason as harakat: they indicate *how*
to pause while reciting, not *which word* was said, so they're irrelevant
to forced alignment's word-matching but essential to `displayText`
rendering (a learner needs to see them to recite correctly, which is a
tajweed/pedagogy concern distinct from the alignment/evaluation pipeline).

## What this module does not do

- It does not perform phonetic transliteration or any ASR-specific
  normalization beyond diacritic stripping (e.g., hamza-form unification,
  alef-variant folding) — if Milestone C's forced-alignment work needs
  further normalization for matching against ASR output, that's a
  separate, explicitly-named transform layered on top of
  `normalizedText`, not a change to this module's stripping rules (which
  are about tokenization structure, not ASR-model-specific preprocessing).
- It does not validate that a given ayah's word count matches any
  external expectation — that's the import pipeline's job
  (`content-import/verify.ts`), which cross-checks per-surah *ayah* counts
  against Tanzil's `quran-data.xml`; per-word counts are not
  independently published anywhere to verify against.
