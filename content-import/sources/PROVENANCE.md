# Source provenance — Tanzil Quran text

This directory holds the exact, unmodified source files the content import
pipeline reads. Nothing in this directory is hand-edited; if Tanzil
publishes a new version, replace these files by re-running the fetch below
and re-running `pnpm content:import`, never by editing them directly.

## `tanzil-uthmani-v1.1.txt`

- **Fetched**: 2026-07-03
- **Source**: `https://tanzil.net/pub/download/index.php`, POST with
  `quranType=uthmani`, `outType=txt-2` (pipe-delimited `sura|aya|text`,
  Uthmani script as in the Madina Mushaf), `marks=true`, `sajdah=true`,
  `tatweel=true`, `agree=true` — the same parameters the form at
  `https://tanzil.net/download/` submits for "Uthmani" + "Text (with aya
  numbers)".
- **License**: Creative Commons Attribution 3.0 (embedded in the file's own
  trailing copyright block; also stated at `https://tanzil.net/docs/Text_License`).
  Verbatim copying and redistribution is explicitly permitted; the text
  itself must never be altered.
- **SHA-256**: `bf4f57b968d03f4131c070b1e285da9be0e0a108a21c910e872801ca273312c8`
- **Verification method**: Tanzil does not publish an independent
  checksum for this dynamically-generated export (the txt-2 output varies
  by the marks/sajdah/tatweel options selected), so a third-party checksum
  comparison isn't possible for this exact artifact. Instead, the importer
  cross-checks the **structure** of the downloaded file against Tanzil's
  own independently-published `quran-data.xml` metadata: every one of the
  114 surahs' ayah counts must match exactly, and the total must be 6236
  ayat. This was verified manually before this file was committed (zero
  mismatches; see the CLI's own re-verification in
  `content-import/verify.ts`, which runs the same check on every import).
  The SHA-256 above is recorded so any future re-fetch can be diffed
  byte-for-byte against this exact copy.

## `tanzil-quran-metadata-v1.0.xml`

- **Fetched**: 2026-07-03
- **Source**: `http://tanzil.net/res/text/metadata/quran-data.xml`,
  linked from `https://tanzil.net/docs/quran_metadata`.
- **License**: `cc-by` (declared in the file's own `<quran ... license="cc-by">` root attribute).
- **SHA-256**: `8867c1d88191472adec9db694b3cd9f135b1a2ef580574d32cf888dcb22c5c7a`
- **Contents**: per-surah ayah counts, Arabic/English/transliterated
  names, revelation order and type, ruku counts — used both for structural
  verification of the Uthmani text (above) and as the Library screen's
  surah metadata (Milestone B task 4).

## What the importer does NOT do

The importer (`content-import/`) never generates, edits, or infers Quran
text. It only: reads these files verbatim, parses their existing structure,
computes a checksum over what it read, and writes rows referencing that
exact content. If either file needs to change, it is replaced wholesale by
a new fetch from Tanzil, never patched.
