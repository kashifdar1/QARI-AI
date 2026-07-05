# Milestone C — End-to-End Vertical Slice (Listen → Record → Upload → Evaluate → Feedback → Retry)

Read `CLAUDE.md` fully. Milestones A and B must be green. State scope and
acceptance criteria back before starting.

## CRITICAL SCOPE CLARIFICATION — read twice

This milestone is complete ONLY with a **working ML baseline**, not a stubbed
inference response. "Working baseline" means, at minimum:

- A pretrained Arabic ASR checkpoint (wav2vec2 or Whisper family; prefer a
  Quran-fine-tuned checkpoint if one with a usable license is available)
  loaded in `services/inference`.
- **CTC forced alignment of the recorded audio against the KNOWN target
  passage tokens** (from Milestone B tokenization) producing word-level
  timings and per-word alignment scores.
- Deviation candidate generation (omission / repetition / substitution) via
  alignment-gap + edit-distance logic over the aligned token sequence.
- A calibration placeholder is acceptable (calibration data comes in
  Milestone H), but confidence tiers must be produced from real alignment
  scores using documented provisional cut-points — not hardcoded outputs.

The ONLY permitted stub in this milestone is pronunciation/tajweed signals
(explicitly deferred). If the model download is blocked by the environment,
STOP and report it as a blocker — do not substitute fake evaluation results
and do not mark the milestone complete.

## Tasks

1. **Recording (`apps/mobile` features/practice)**
   - Implement the canonical recorder state machine (the tested XState def
     from Milestone 0) wired to real capture in the Expo dev-client:
     permission handling with a real permission-denied state, visible mic
     state, elapsed time, waveform, pause/restart, local playback before
     submission.
   - Output: 16 kHz mono 16-bit PCM WAV (transcode on device if needed;
     document the module in ADR-007).
   - Local persistence: the file survives app backgrounding and restart in
     `review-local` state.

2. **Upload & attempt lifecycle (`services/api`)**
   - `POST /v1/attempts` with client attempt UUID (idempotent — prove with a
     duplicate-request test), returning short-lived signed upload instructions
     to the private bucket (MinIO locally).
   - `POST /v1/attempts/{id}/complete` validates the object exists, records
     duration/device metadata, and enqueues an EvaluationJob (BullMQ).
   - Authorization tests: another user/profile cannot create, complete, read,
     or delete this attempt.

3. **Evaluation pipeline (`services/inference` + orchestrator)**
   - Audio quality gate: duration bounds, silence ratio, clipping, SNR
     estimate → `needs-rerecord` with specific guidance when failed.
   - Forced alignment + deviation candidates as specified above.
   - Feedback policy layer in `packages/domain` (TypeScript, unit-tested):
     converts raw candidates + scores into the structured feedback object
     (`evaluationStatus, passageVersion, modelBundleVersion, audioQuality,
     wordSegments[], issueCandidates[], confidenceTier, coachingMessages[],
     referenceAudioSlices[], retryRecommendation, teacherReviewAvailable`).
     Child profiles get stricter abstention per ADR-005. High-confidence
     labels remain feature-flagged per CLAUDE.md §4.
   - Persist EvaluationResult with model_bundle_version + content_version_id.
   - Job telemetry: latency, failure codes, confidence distribution counters.

4. **Feedback & retry UI**
   - Processing screen with cancel; polling `GET /v1/evaluations/{id}`.
   - Feedback screen: word timeline highlighting matched / uncertain /
     skipped / repeated / possibly-substituted; tap-to-hear reference word or
     phrase (sliced via the timing map) and compare with the learner's clip;
     "possible issue" wording for medium confidence; explicit low-confidence
     state that does NOT call anything a mistake; "Ask a teacher" entry point
     (disabled with "coming soon" — real path per Principle 4).
   - Retry from feedback creates a new attempt in the same session; session
     history records both.
   - Incorrect-feedback report: `POST /v1/evaluations/{id}/report` wired to a
     real button.

5. **Golden corpus seed (`test-data/golden-audio`)**
   - Record or source at least 12 consented sample clips for 2–3 approved
     passages: clean correct, deliberate single-word omission, repetition,
     substitution, noisy, too-short, and silent. Document provenance/consent
     in `test-data/golden-audio/README.md`. If you cannot legitimately obtain
     clips, generate ONLY the non-recitation cases (silence, noise, tone) and
     report the recitation clips as a blocker for the human owner — never
     synthesize recitation audio.
   - An integration test runs the pipeline over the corpus and asserts:
     quality gate catches the bad-audio cases; the omission clip yields an
     omission candidate in the correct region; the clean clip yields no
     high-confidence issue.

## Acceptance criteria

- On a device/simulator: select an approved passage → listen → record → lose
  network mid-upload → recover → upload → receive real evaluation feedback →
  tap-to-compare → retry. Demonstrate with logs/screens.
- Duplicate attempt-creation request returns the same attempt (idempotency test).
- Golden-corpus integration test passes with REAL inference (no stub in path).
- Low-confidence result renders the abstain state, verified by a UI test.
- All lint/typecheck/tests green; ≥ 80% coverage on domain + policy layer.
- File tree diff + real outputs + honest risks (expected: child-audio accuracy
  unknown, calibration provisional, single reciter, tajweed deferred).
