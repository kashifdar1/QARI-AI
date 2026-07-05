# Milestone B — Versioned Quran Content Model & Passage Browser

Read `CLAUDE.md` fully. Milestone A must be green. State scope and acceptance
criteria back before starting.

## Scope

The sacred-content pipeline: verified import, versioning, checksums, passage
API, and the mobile Library + Passage Preview screens with reference audio
playback. This milestone touches Quranic text — Principle 1 applies with
maximum strictness.

## Tasks

1. **Content import pipeline (`packages/content-schema` + a real CLI)**
   - CLI: `pnpm content:import --source tanzil --file <path>` that ingests the
     Tanzil Uthmani text file, verifies its published checksum, and writes a
     QuranContentVersion (status `imported`, riwayah `hafs_an_asim`) with
     surah/ayah rows. The importer is the ONLY code path that writes Quran text.
   - A review step: `pnpm content:approve --version <id> --reviewer <name>`
     transitions `imported → approved` and records an AuditEvent. Only
     `approved` versions are servable.
   - Word tokenization stored per ayah (needed later for alignment); document
     the tokenization rules (waqf marks, diacritics handling) in
     `docs/content-tokenization.md`.
   - MVP passage set: define an `approved_passages` seed (suggest: Al-Fatihah
     and Juz 'Amma short surahs, An-Nas through Ad-Duha) — passages reference
     an approved content version.

2. **Reference audio metadata**
   - ReciterAudio records with reciter name, riwayah, license text/URL, object
     key, and verse timing map (QUL segment format where available).
   - A `content:audio-manifest` CLI that validates every referenced object
     exists in storage and every ayah in the passage set has audio + timing.
   - For development, use ONE reciter whose license is documented in
     `docs/licenses/`. If no cleared audio is available yet, follow Stub
     Policy: silent placeholder tones named `PLACEHOLDER_AUDIO`, listed in
     docs/STUBS.md — never fake "recitation."

3. **Content API**
   - Implement `GET /v1/content/passages` (+ passage detail) per contract:
     versioned, cache-friendly (ETag on content version checksum), returning
     Arabic text, verse numbers, riwayah label, reciter metadata, and
     translation toggle data (translation source must also be licensed and
     versioned; en + ur translations with named sources).
   - Contract tests + authorization tests (content is public-read but
     rate-limited; no auth bypass elsewhere).

4. **Mobile Library & Passage Preview**
   - Library screen: browse by Surah and Juz, bookmarks (local), download
     status indicator (offline packs deferred to Milestone D — show state only).
   - Passage Preview: canonical Arabic rendered with the bundled Hafs font,
     verse numbers, riwayah badge ("Hafs 'an 'Asim"), translation toggle,
     adjustable-speed reference playback WITHOUT pitch distortion (verify the
     audio lib supports time-stretch; document choice in ADR-006), verse-range
     selection UI.
   - Arabic rendering QA: visual regression snapshots for at least 3 surahs at
     3 font scales, light + dark; verify no glyph-shaping breakage.

## Acceptance criteria

- Import CLI run against the real Tanzil file produces a checksum-verified,
  approved content version; show the real command output.
- Grep proves no Quranic Arabic string literals exist outside imported data.
- Passage API contract tests pass; ETag/versioning behavior tested.
- Library → Preview flow works on device/simulator with playback speed change.
- RTL/ar/ur rendering tests pass; Arabic visual snapshots reviewed.
- File tree diff + real test output + honest risks. Do not begin Milestone C.
