# ADR-009: Deviation Candidates Diff at Character Level, Not Word Level

- Status: Accepted, fixed and unit-tested; underlying model-quality limitation documented, not fixed (Milestone H scope)
- Date: 2026-08-03

## Context

First real recitation audio verified end-to-end on a physical Android
device (`docs/adr/008-android-raw-pcm-capture.md`), two passages: Al-Fatiha
(1:1-7) and Al-Ikhlas (112:1-4). Al-Fatiha's 5.12s recording was too short
for its 29-word/7-ayah target and produced degenerate all-zero-timing
alignment — an audio/content mismatch, not a code bug, so a shorter surah
was tried next.

Al-Ikhlas's 14.24s recording passed the audio quality gate and produced
genuine, non-degenerate forced-alignment word timings correctly spread
across the full recording — the pipeline itself (capture → upload → queue
→ decode → forced alignment) is confirmed healthy. But every one of the 19
target words was flagged as an issue candidate (mostly `substitution`),
regardless of what was actually said, and the app correctly (per Principle
2) abstained rather than show any of them — nothing unsafe reached the
user, but the deviation-candidate signal itself was not doing its job.

## Root cause 1 (fixed): word-boundary-token dependency

`app/deviation.py` computed deviation candidates by running a second,
*unconstrained* greedy CTC decode of the same audio, splitting that free
decode into words on the model's `|` word-boundary symbol, then diffing
the resulting word list against the target word list
(`difflib.SequenceMatcher`).

For continuous, pause-free recitation, the model's argmax path never
predicted a `|` symbol at all — there was no acoustic "silence" cue between
words for it to key off. `text.split("|")` on a string with zero `|`
characters returns the entire utterance as one element, so the diff
compared 19 target words against 1 giant "word" and marked all 19 as
`replace` (substitution) by construction. This is a general failure mode
of the approach, not specific to this recording: it would misfire on any
correctly-recited passage with no inter-word pauses.

**Fix:** diff at the character level instead. Word ownership on the
reference side comes from the KNOWN target (already available from forced
alignment), not from the free decode — the free decode is now consumed as
a raw, unsegmented character stream (`greedy_ctc_decode_chars`). A target
word is flagged only when a sufficient fraction of its own characters
(`MISMATCH_RATIO_FLOOR`, provisional at 0.5, same calibration status as
the existing `LOW_CONFIDENCE_LOG_PROB`) fall inside a non-`equal` diff
opcode. This removes any dependency on the free decode ever producing an
explicit word boundary.

Regression test added:
`test_missing_boundary_token_does_not_falsely_flag_every_word` in
`services/inference/tests/test_deviation.py` — a correct two-word decode
with the boundary symbol entirely absent must yield zero candidates. All
28 inference tests pass after the change.

## Root cause 2 (documented, not fixed — Milestone H scope): weak unconstrained decode quality

Re-running the fixed code against the real Al-Ikhlas recording still
flagged all 19 words. Diagnosis (`SequenceMatcher.ratio()` and matching
blocks between the flattened target characters and the free-decoded
character stream): only ~18% character overlap, with just a handful of
short fragment matches (e.g. "قُل" was correctly recognized as a
substring). The model's frame-level top-1 softmax confidence was high
(~0.97 mean) — it is not "unsure" — but its *unconstrained* argmax path
simply does not track the target text well for continuous speech.

This is consistent with the model bundle
(`HamzaSidhu786/wav2vec2-base-word-by-word-quran-asr`) being fine-tuned for
word-level forced alignment, not open transcription — exactly the
distinction CLAUDE.md §3 already draws ("Forced alignment against the
KNOWN target text — this is not open transcription"). Forced alignment
(constrained to the correct answer) is unaffected and continues to produce
sensible word timings; the *free* decode used only for deviation-candidate
generation is the weak link.

**Not fixed in this session** — this is a model-quality/methodology
question (a better decoding strategy, e.g. constrained beam search with a
character LM, or a checkpoint better suited to open decoding, or possibly
a different deviation-detection method entirely that doesn't need a free
decode) that belongs to Milestone H's golden-corpus calibration work, per
CLAUDE.md §4 ("Confidence calibration... before that tier's labels are
enabled"). The existing safety nets — low-confidence abstain and
`ALL_LABELS_DISABLED` as the default feature-flag state — already prevent
this weak signal from reaching users as a false accusation, which is the
non-negotiable requirement (Principle 2); nothing here is user-visible
today.

## Consequences

- The character-level diff is the structurally correct approach regardless
  of decode quality — it should stay even after the free-decode itself is
  improved.
- Milestone H must treat "does the free decode carry any real signal for
  this checkpoint" as an open question, not an assumption. If it does not
  improve, the deviation-candidate mechanism may need to be redesigned
  around a different signal than an unconstrained free decode (e.g. purely
  from forced-alignment confidence, without a separate free-decode diff at
  all).
- No action needed on the label feature-flag defaults — they were already
  correctly closed.
