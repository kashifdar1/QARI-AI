# Stubs

Per CLAUDE.md §7 (Stub Policy): a stub is acceptable only when a real
implementation is blocked by an external dependency. Every stub here lives
behind the same interface as its real implementation, is named
`*.stub.ts`/`*_stub.py` (or documented as a stub inline where that naming
doesn't map cleanly), and logs `STUB` at startup/first use.

## `POST /v1/evaluate` — `services/inference/app/evaluate_stub.py`

**Blocked by:** no licensed, Quran-fine-tuned Arabic ASR checkpoint has been
selected or obtained yet. ADR-001 names wav2vec2/Whisper-family candidates
as the intended approach (forced alignment against known text, not open
transcription), but choosing and licensing a specific checkpoint is
Milestone C scope.

**Behavior:** returns a structurally valid `EvaluateStubResponse` with
`is_stub: true`, `model_bundle_version: "stub-0.0.0"`, and an empty
`word_segments` list. Logs a `STUB` warning on every invocation and at
service startup.

**Unblocking condition:** a checkpoint is selected, its license verified,
and it is loaded into `services/inference`, replacing `evaluate_stub.py`
with a real forced-alignment implementation behind the same
`POST /v1/evaluate` contract. Tracked for Milestone C
(`docs/backlog.md` Milestone C acceptance criteria EVAL-001/002/003).

## Font binaries — `packages/ui/assets/fonts/`

**Blocked by:** the actual font files require a human to source and verify
licenses; no binary is fabricated per Principle 7. Full detail in
`packages/ui/assets/fonts/README.md`.

**Behavior:** `packages/ui/src/theme/typography.ts` defines the font family
*names* (`fontFamilies.arabic.regular`, etc.) that `apps/mobile` will load
via `expo-font`, but no `.ttf`/`.otf` file is committed yet. Components
reference these family names; if unregistered at runtime, React Native
falls back to the system font rather than crashing.

**Unblocking condition:** a maintainer downloads KFGQPC Uthmanic Script
Hafs (with its license), Noto Nastaliq Urdu, Noto Naskh Arabic UI, and
Inter from their verified sources, adds each license file alongside its
font, and wires them into `apps/mobile`'s `app.json` / `expo-font` config.

## Reference audio — `services/api/src/content-import/placeholderAudio.ts`

**Blocked by:** no reciter's audio license has been verified yet
(`docs/licenses/README.md`) — CLAUDE.md's own README lists this as a
human-owner task, not something to resolve by guessing at a source's
license terms.

**Behavior:** every MVP passage's `ReciterAudio` row (seeded by
`seedPlaceholderReciterAudio.ts`) points at a genuinely real, silent,
16kHz mono 16-bit PCM WAV file, named `PLACEHOLDER_AUDIO_surah-NNN.wav`
and flagged `is_placeholder: true`. These are real, valid audio files (see
`content-import/placeholder-audio/`, verified with `file(1)` to be actual
RIFF/WAVE PCM data) — never a fabricated binary, and never anything
resembling actual recitation.

**Unblocking condition:** a maintainer clears a reciter's license
(`docs/licenses/<reciter-id>.md`), uploads the real audio to object
storage, and re-runs the reciter-audio seed against the real reciter
instead of the placeholder, flipping `is_placeholder` to `false`.

## Verse-level word timing (QUL segment data) — not implemented

**Blocked by:** no QUL (Quranic Universal Library) timing dataset has been
obtained or licensed yet (ADR-003/CLAUDE.md §3 name QUL as the intended
source "where licensed"). No `WordSegment`-style per-ayah timing rows are
written for content by this milestone.

**Behavior:** the content API returns ayah/word text and whole-passage
reference audio, but no word-level timing offsets within that audio.

**Unblocking condition:** a maintainer obtains and verifies a license for
QUL (or equivalent) timing data matching the cleared reciter above, and a
new import step populates timing rows against the same `quran_ayah_words`
rows this milestone creates.

## Translation text — `services/api/src/db/schema/content.ts` (`quranTranslationAyat`)

**Blocked by:** Tanzil's hosted translations (`https://tanzil.net/trans/`)
are licensed **"for non-commercial purposes only"** unless explicit
permission is obtained from the translator/publisher — a materially more
restrictive license than the Quran text itself (which permits verbatim
redistribution under CC-BY). No translation text has been fetched or
embedded.

**Behavior:** `translation_versions.license_status` defaults to
`blocked_non_commercial`; the content-import pipeline and content API
enforce that no `quran_translation_ayat` row may exist for a version whose
license isn't `cleared`. The translation toggle in the passage detail
response is present in the contract but returns no translation data until
a version is cleared.

**Unblocking condition:** a maintainer either (a) confirms Qari AI's use
qualifies as non-commercial, (b) obtains explicit commercial-use
permission from a specific translator/publisher, or (c) sources a
translation under a license that already permits commercial redistribution
(e.g. certain public-domain English translations) — then imports it via a
new `content:import-translation` command (not yet built) and flips
`license_status` to `cleared`.

## Urdu/Arabic translation strings — `apps/mobile/src/i18n/locales/{ar,ur}.json`

**Not a code stub** (no interface substitution — the strings are real and
in production shape), but flagged per the Milestone A prompt's explicit
instruction: these translations, including the trust-critical consent
sentence in `onboarding.consent.body`, were machine-drafted by Claude Code
and have **not** been reviewed by a native/qualified Urdu or Arabic
speaker.

**Unblocking condition:** human review of `ar.json` and `ur.json` (all
keys, but `onboarding.consent.body` especially, since it carries the
Principle 4 trust disclosure) before these strings ship to real users.
Tracked as Milestone G (Localization Hardening) scope in `docs/backlog.md`,
but should not wait that long given the consent screen ships in Milestone A.
