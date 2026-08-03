# Implementation Gaps & Deviation History

This file tracks the gap between what CLAUDE.md / the milestone docs
(`00-kickoff-architecture.md` through `03-milestone-C-vertical-slice.md`)
require, and what's actually true in the code right now — plus the concrete
environment/session history of how deviations were found and handled. Update
this file whenever a gap is closed or a new one is discovered; don't let it
go stale the way `docs/STUBS.md`'s `evaluate_stub.py` entry did (see below).

Last full audit: 2026-07-05 (session 2, §8 closed).

---

## 0. Milestone C vertical-slice wiring — BEFORE / AFTER (2026-07-05, session 2)

Triggered by manually testing "Upload" on device and hitting the local
"Recording saved... uploading isn't available yet" screen (itself built
earlier this session as an honest stand-in). This section is the
before/after record for closing §3b/§3c below — update the AFTER half once
each piece lands; don't mark anything done until it's actually been
exercised, not just written.

**BEFORE (state at start of this work):**
- `services/api/src/server.ts` passes only `userRepository`,
  `contentRepository`, `reciterAudioRepository` to `buildApp()` — attempt
  repository, evaluation queue, and object storage all silently default to
  in-memory/fake implementations (`app.ts:82-84`).
- `objectStorage.ts` contains only `FakeObjectStorage` — no real S3/MinIO
  client exists anywhere in the repo.
- `BullMqEvaluationQueue` is defined but never imported outside its own
  file — dead code.
- No queue-consumer/worker file exists anywhere in `src/`.
- No route creates a `profiles` or `practice_sessions` row — discovered
  mid-investigation this session: `POST /v1/sessions/:sessionId/attempts`
  requires a session to already exist (`findSessionOwnership`), but nothing
  in the API can create one. This is a bigger gap than §3b originally
  documented.
- `apps/mobile` has no auth client, no session client; `Recite`'s
  post-recording screen only saves locally and explicitly says upload
  isn't available.
- `Processing.tsx`/`FeedbackReport.tsx` are coded, unit-tested, unreachable
  from `AppNavigator`.
- `FeedbackReport.tsx:84` "tap to hear reference" button is `onPress: () =>
  {}`, a no-op.
- Known, separately-tracked limitation going into this work: Android's
  recorder only produces `.m4a` (AAC) — `services/inference`'s
  `decode_wav_base64` uses `soundfile`, which cannot parse an AAC/M4A
  container. So even with the full pipeline wired, a real recording made
  on the physical Android device will reach the worker and fail decode
  there. iOS's recorder already produces genuine 16kHz mono 16-bit PCM WAV
  (via `IOSOutputFormat.LINEARPCM`), so that path should work fully without
  needing on-device transcoding. Building a real AAC→WAV transcoder is out
  of scope for this pass — it's a separate, substantial native-module
  addition (Milestone C's own ADR-007 scope, already flagged).

**AFTER: closed 2026-07-05 — see §8 at the end of this file for the full
before/after diff and the real `curl` verification walkthrough.**

---

## 1. Milestone A — Repository Foundation & Design System

**Status: mostly green, one real acceptance-criteria violation.**

| Item | Required by | Actual state |
|---|---|---|
| CI green on a clean clone | Milestone A acceptance | **FAILED.** Last run (`gh run view 28735389398` on `main`, 2026-07-05) failed at the Node test step: `apps/mobile` — 3 suites / 3 tests failed on `Recite.test.tsx`, `FeedbackReport.test.tsx`, `PassagePreview.test.tsx`, all `Exceeded timeout of 5000 ms`. `services/inference` job (ruff/mypy/pytest) passed. |
| `apps/mobile` Jest suite determinism | implicit (tests must be trustworthy) | **Flaky, not deterministic.** Same suite passed 46/46 locally on one run and failed 6/46 on another (same 5000ms-timeout pattern), and failed in the actual CI run above. Root cause not yet diagnosed — likely React Native Testing Library + fake timers/native-module mocks under load/CI resource contention. Until fixed, a green local run doesn't prove CI will pass. |
| Redaction test proves signed audio URLs never reach logs | Milestone A acceptance | ✅ Real and passing — `services/api/src/logging/redact.test.ts`. |
| ≥80% coverage on `packages/domain` + auth/authorization | Milestone A acceptance | ✅ `feedbackPolicy.ts` at 98%; auth/authorization tests pass (93/93 in `services/api`). |
| `docker-compose` for local Postgres/Redis/MinIO | Milestone A task 1 | ✅ **Closed 2026-07-22** — used for real for the first time, on the Windows machine (session 3, see §9), standing up Postgres/Redis/MinIO with no native installs. Migrations, bucket creation, and the full API test suite all ran successfully against it. |
| Lint rule: `packages/domain` stays framework-free | implied by ADR-001 ("a lint rule enforcing this is expected in Milestone A") | **Missing.** No `no-restricted-imports` rule in root `.eslintrc.json`; nothing currently prevents `packages/domain` from importing `fastify` or `react-native`. |
| Grep-based CI check: no Quranic Arabic literals outside content storage | `docs/backlog.md` CONTENT-002 (Milestone B, but infra lands here) | **Missing.** No CI step or script implements this. Principle 1 is currently upheld by convention/discipline only, not enforced. |

## 2. Milestone B — Versioned Quran Content Model & Passage Browser

**Status: green.** Content import, approve, MVP passage seed, audio manifest,
ETag/versioning, and Arabic RTL rendering tests are all real and passing.

- `content:audio-manifest` CLI: passes (confirmed this session against the
  live local DB — 23/23 passages have valid placeholder audio references).
- ETag/versioning: real, in `services/api/src/content/routes.ts:26-46` +
  `content/routes.test.ts`.
- `ArabicRendering.test.tsx`: real, passing RTL/visual test, not scaffolding.
- No open gaps found against this milestone's task list or acceptance
  criteria.

## 3. Milestone C — End-to-End Vertical Slice

**Status: partially built, and the biggest gap in the whole project — the
backend attempt/evaluation lifecycle is real in isolation but never wired
together, in any environment, including production.**

### 3a. What's real and tested
- **ML baseline is genuinely real**, not a stub, contrary to what
  `docs/STUBS.md` currently says (see §4). `services/inference` loads an
  actual HuggingFace checkpoint
  (`HamzaSidhu786/wav2vec2-base-word-by-word-quran-asr`, Wav2Vec2ForCTC,
  Apache-2.0) and does real CTC forced alignment (`app/ctc_alignment.py`,
  a from-scratch Viterbi implementation) and real deviation-candidate
  generation (`app/deviation.py`, greedy-CTC-decode + `difflib` diff).
  27/27 pytest tests pass against the real cached checkpoint.
- `POST /v1/attempts` idempotency: real, passing test
  (`attempts/routes.test.ts:37`).
- Cross-user authorization on attempts (create/read/complete): real, passing
  tests (`routes.test.ts:93,104,129,155`).
- `POST /v1/attempts/{id}/report`: real endpoint, real tests, real UI
  handler in `FeedbackReport.tsx:99-110` — just not reachable (see 3c).
- `packages/domain/src/feedback/feedbackPolicy.ts`: real, 98% coverage,
  10 passing tests.
- Recorder state machine (`Recite.tsx` + `expoAudioRecorder.ts`): real
  native mic capture via `expo-audio` (fixed this session — see §5). Full
  permission → ready → recording → stop → review flow works end to end on
  a physical Android device.

### 3b. The load-bearing gap: nothing connects the real pieces together
- `services/api/src/server.ts` (the actual production entrypoint) calls
  `buildApp({...})` passing only `userRepository`, `contentRepository`,
  `reciterAudioRepository`. It **never passes** `attemptRepository`,
  `evaluationQueue`, or `objectStorage`.
- `app.ts:82-84` silently defaults all three to in-memory/fake
  implementations when omitted: `InMemoryAttemptRepository`,
  `InMemoryEvaluationQueue`, `FakeObjectStorage`.
- **There is no real object storage implementation at all** — grepping the
  whole repo for `@aws-sdk` or `minio` package usage returns nothing.
  `objectStorage.ts` contains only `FakeObjectStorage`. This means uploads
  can never actually reach a bucket in any environment right now, not just
  locally.
- **`BullMqEvaluationQueue` exists but is dead code** — defined in
  `bullmqEvaluationQueue.ts`, never imported anywhere else in `src/`.
- **There is no queue-consumer/worker file anywhere.** Even if Redis/BullMQ
  were running and wired in, nothing in the checked-in server code would
  ever dequeue a job and call `evaluationOrchestrator.processAttempt`. That
  function is only ever called from its own unit test and the manual
  golden-corpus script.
- Per CLAUDE.md §7 (Stub Policy), `FakeObjectStorage` and
  `InMemoryEvaluationQueue` should be named `*.stub.ts`, log `STUB` at
  startup, and be listed in `docs/STUBS.md` with an unblocking condition.
  None of that has happened — this is a **Stub Policy violation**, not just
  a missing feature.
- **Net effect**: even with Postgres + the real inference model running
  (as they were this session), a real recording could not currently be
  uploaded, queued, evaluated, and fed back to the user through the actual
  server entrypoint. The "vertical slice" doesn't yet actually slice
  vertically in the shipped server.

### 3c. Mobile-side wiring gaps
- **No auth/login UI exists in `apps/mobile` at all.** `AttemptsClient`
  requires a bearer token; nothing in the app can obtain one. Discovered
  and reported to the user this session (2026-07-05) when asked "how do I
  read and record Quran" — reading works, recording-and-uploading does not,
  because there's no way to authenticate.
- **`Processing.tsx` and `FeedbackReport.tsx` are fully coded and
  unit-tested but not reachable from `AppNavigator`.** Only
  `Recite`'s local "recording saved" confirmation screen (added this
  session) is wired in after recording — it explicitly does not attempt to
  upload, since there's no auth and the upload path isn't connected
  end-to-end server-side either (see 3b).
- **"Tap to hear reference audio" is a no-op UI stub**:
  `FeedbackReport.tsx:84`, `onPress={() => {}}`. No audio-slicing/playback
  code exists behind it despite `referenceAudioSlices` being present in the
  DTO.
- Golden corpus (`test-data/golden-audio/`) has **no recitation clips at
  all** — only non-recitation cases (silent, white-noise, clipped, too-short
  tone). This is a legitimate, documented human-owner blocker per Principle
  1/7 (real consented recitation clips are required, never synthesized),
  but it means Milestone C's acceptance criterion "the omission clip yields
  an omission candidate in the correct region; the clean clip yields no
  high-confidence issue" is **not verifiable yet** — the golden-corpus
  integration script only exercises the audio-quality-gate rejection cases,
  and isn't even wired into `pnpm test` (manual-invocation only, ~30-60s
  model load time).

### 3d. ADR-vs-code drift
- `app/model.py`'s docstring says "see docs/adr/001-architecture-baseline.md
  ... for the model-selection rationale." ADR-001 covers the CTC-vs-Whisper
  architectural choice well, but does **not** document the specific
  checkpoint (`HamzaSidhu786/wav2vec2-base-word-by-word-quran-asr`), its
  license verification, or why it was chosen over alternatives. No ADR
  currently exists for that specific decision.

## 4. `docs/STUBS.md` is stale and needs a rewrite

Its first entry currently describes `services/inference/app/evaluate_stub.py`
as the blocked implementation for `POST /v1/evaluate`. That file no longer
exists (only `.pyc` cache remnants) — the real model-backed implementation
(§3a above) has replaced it, but the doc was never updated to reflect that.
Conversely, `docs/STUBS.md` has **no entry at all** for the actual current
stubs found this session: `FakeObjectStorage`, `InMemoryEvaluationQueue` (as
used in production, not just tests), and the missing queue-consumer. Fixing
`docs/STUBS.md` to match reality is a small, low-risk follow-up — flagged
here rather than done unprompted since it's documentation content, not this
gaps-tracking file's job to silently rewrite.

## 5. Environment/session history — bugs found and fixed (2026-07-04 → 2026-07-05)

These were real, reproducible bugs hit while first getting the app running
end-to-end (iOS Simulator, then a physical Samsung Android phone). None of
this was a milestone-scope gap — all infrastructure/tooling bugs, listed
here so future sessions don't have to rediscover them.

1. **Project folder had a space in its name** (`QARI AI`) — broke React
   Native's iOS codegen build script (unquoted path split at the space).
   Fixed by renaming to `QARI-AI`.
2. **Xcode 26.5's stricter C++20 Clang broke the `fmt` pod** bundled by
   React Native 0.76 (`FMT_STRING` calls failed as "not a constant
   expression"). Fixed via a `Podfile` `post_install` hook forcing `fmt` to
   build as `gnu++17`.
3. **`index.ts` and several screens imported `./Foo.js` where the real file
   was `Foo.tsx`** — TS's ESM-extension convention (works for `tsc`/Vite)
   isn't understood by Metro's bundler resolver. Fixed with a Metro
   `resolveRequest` hook that retries failed `.js` resolutions against
   `.ts`/`.tsx`, rather than hand-editing every import (this is a
   repo-wide convention, not a one-off typo).
4. **`babel.config.cjs` used raw `@react-native/babel-preset` instead of
   `babel-preset-expo`** — caused the JSX automatic-runtime transform to run
   twice, throwing "Duplicate __self prop found." Fixed by switching to
   `babel-preset-expo` (the standard Expo SDK 52 preset).
5. **No `metro.config.js` existed for this pnpm monorepo** — added one with
   `watchFolders` set to the monorepo root and `unstable_enableSymlinks`/
   `unstable_enablePackageExports` (NOT `disableHierarchicalLookup`, which is
   for hoisted Yarn/npm workspaces and actively breaks pnpm's structure —
   tried it first, had to revert).
6. **`@babel/runtime` was a pnpm "phantom dependency"** — present in the
   store but not declared directly by `apps/mobile` or `packages/ui`, so
   pnpm's strict linking didn't expose it, breaking Babel's injected
   `interopRequireDefault` helper calls at runtime. Fixed by adding it as an
   explicit dependency to both packages (pinned to `^7.26.0` to match the
   rest of the Babel 7.x toolchain — `pnpm add` initially resolved a
   `^8.0.0` that would have been unusable).
7. **`seedPlaceholderReciterAudio.ts` hardcoded `reciterId: 'placeholder-
   reciter'`**, a plain string, into a Postgres `uuid` column — worked in
   unit tests (in-memory fake repo, no type enforcement) but failed for
   real against Postgres. Fixed with a real placeholder UUID constant.
   Also **no CLI entry point existed** to actually run this seed function
   outside of tests — added `seedPlaceholderReciterAudioCli.ts` and its
   `content:seed-placeholder-audio` package.json script.
8. **Expo's Network Inspector (`EX_DEV_CLIENT_NETWORK_INSPECTOR=true` in
   `gradle.properties`/`Podfile.properties.json`) silently hung every
   `fetch()` call** on the physical Android device — `fetch()` never
   resolved or rejected, indefinitely. `curl` from the same device's shell
   worked instantly, which is what pointed at an app-level interception
   layer rather than networking/DNS/firewall. Fixed by setting it to
   `false` in both platform config files.
9. **`expo-audio`'s real native `AudioRecorder` class isn't a bare named
   export** — `import { AudioRecorder } from 'expo-audio'` silently resolves
   to `undefined` at runtime (it only exists as a *type*; the real
   implementation lives at `AudioModule.AudioRecorder`, a property of the
   native module object returned by `requireNativeModule('ExpoAudio')`).
   Calling `new undefined(...)` produced "Cannot read property 'prototype'
   of undefined" — but only became visible once `Recite.tsx` got real
   try/catch error handling around the recorder calls (it had none before;
   failures were silent unhandled-promise-rejections that just left the UI
   stuck). Also had to flatten the nested `{ android: {...}, ios: {...} }`
   `RecordingOptions` shape into a single object before passing it to the
   native constructor (expo-audio's own `useAudioRecorder` hook does this
   internally via an unexported `createRecordingOptions` helper — had to
   replicate that logic manually since we're not using the hook).

## 6. Unresolved as of 2026-07-05

- ~~`MediaRecorder.stop()` throws a native `IllegalStateException`~~ —
  **root-caused and fixed 2026-07-05.** Added `getStatus()` diagnostics
  around `record()`/`stop()` and found `isRecording` stayed `false` and
  `durationMillis` stayed `0` indefinitely after calling `record()` — not a
  timing artifact (checked at 0ms/500ms/1500ms). Traced to a genuine
  **inverted condition in `expo-audio@0.3.5`'s own Android native module**:
  `AudioModule.kt`'s `Function("record")` wrapper reads
  `if (!ref.isPrepared) { ref.record() }` — but `prepareToRecordAsync()`
  sets `isPrepared = true` on success, so the real `ref.record()` (which
  calls `MediaRecorder.start()`) never ran. `stop()` then threw
  `IllegalStateException` because the underlying `MediaRecorder` had only
  ever been `prepare()`d, never `start()`ed. Fixed with a `pnpm patch`
  (`patches/expo-audio@0.3.5.patch`, registered in `package.json`'s
  `patchedDependencies`) flipping the condition to `if (ref.isPrepared)`.
  Requires a full native rebuild (`expo run:android`) to take effect, since
  it's a Kotlin file change, not JS. **Not yet re-verified end-to-end on
  device after the fix** — do that next.
- ~~Everything in §3b/3c above (object storage, queue consumer, mobile auth,
  Processing/FeedbackReport navigation wiring, tap-to-hear playback) is
  unbuilt, not merely untested.~~ — **closed 2026-07-05, see §8.**
- `apps/mobile`'s Jest suite flakiness (§1) is unexplained.
- Android's recorder still only produces `.m4a` (AAC); `services/inference`'s
  `soundfile`-based decoder cannot parse it. A real on-device Android
  recording will now travel the full real pipeline (upload, queue, worker)
  and fail honestly at decode inside the worker, rather than failing
  earlier for lack of plumbing. Fixing this needs a native AAC→WAV
  transcode step (Milestone C's ADR-007 scope) — not attempted this pass.
  iOS's recorder already emits real WAV and is unaffected.
- `referenceAudioSlices[].audioUrl` (packages/domain's `buildFeedback`) is
  still just the bucket-root URL + a `#t=` fragment, not a real per-word
  audio object key — `FeedbackReport.tsx` was deliberately changed to play
  the passage's real full reference audio instead of pretending word-level
  slicing works. Real per-word tap-to-hear needs QUL word-timing data
  (separately documented license blocker, `docs/STUBS.md`).
- The mobile-side auth session is in-memory only (created fresh per app
  launch); there's no persisted guest identity across app restarts. Fine
  for exercising the pipeline, not a real account system.

## 7. Test health snapshot (2026-07-05, `turbo run test --force`)

| Workspace | Files | Tests | Result |
|---|---|---|---|
| `@qari/admin` | 1 | 1 | pass |
| `@qari/content-schema` | 6 | 19 | pass |
| `@qari/domain` | 4 | 36 | pass |
| `@qari/config` | 1 | 3 | pass |
| `@qari/ui` | 8 | 23 | pass |
| `@qari/api` | 19 | 98 | pass |
| `@qari/mobile` | 9 | 46 | pass *this run* — flaky, see §1 |
| `services/inference` (pytest, not part of `pnpm test`) | 5 | 27 | pass |

253 tests total when everything is green (2026-07-05, after §8's work;
`@qari/api` grew from 93→98 tests / 17→19 files with the new session
routes; `@qari/mobile` count unchanged because AppNavigator's own test
file wasn't extended to cover the new upload flow — see §8's "known gaps"
note).

## 8. Milestone C vertical-slice wiring — AFTER (2026-07-05, session 2)

Closes §0/§3b/§3c. Every piece below is a real, inspectable file — nothing
here is a stub or a claim of background work; the end-to-end pipeline was
exercised with real `curl` calls against the running services (see the
walkthrough at the bottom of this section) while the phone was
disconnected, per the session's own instruction to leave everything
verifiable server-side.

**Backend (`services/api`):**
- `objectStorage.ts` / `objectStorageReader.ts`: added `S3ObjectStorage` /
  `S3ObjectStorageReader`, real `@aws-sdk/client-s3` clients against MinIO
  (`forcePathStyle: true`), replacing the silent fake default.
- `sessions/`: new `profileRepository.ts` + `drizzleProfileRepository.ts`,
  `sessionRepository.ts` + `drizzleSessionRepository.ts`, and `routes.ts`
  (`POST /v1/profiles`, `POST /v1/sessions`) — the previously-missing piece
  that nothing could create a `profiles` or `practice_sessions` row at all.
  Object-level auth enforced: creating a session for a profile you don't
  own returns 403.
- `app.ts`: hoisted `contentRepository`/`profileRepository`/
  `sessionRepository` construction above route registration (was scoped
  inside a closure, unreachable from the new session routes); wired a real
  `resolveProfileAgeClass` callback (was silently hardcoded to `'adult'` —
  a genuine Principle-5 child-safety bug, found and fixed proactively while
  in the area, not something the milestone doc called out directly).
- `server.ts`: rewritten to wire every real implementation
  (`DrizzleUserRepository`, `DrizzleAttemptRepository`,
  `BullMqEvaluationQueue`, `S3ObjectStorage`, `DrizzleProfileRepository`,
  `DrizzleSessionRepository`, `DrizzleEvaluationResultRepository`,
  `DrizzleReportRepository`) instead of defaulting to in-memory/fake ones.
- `worker.ts` (new): the previously-nonexistent BullMQ consumer. Loads
  attempt → session → profile → passage, flips status to `processing`,
  calls `processAttempt` against the real inference service and real
  object storage, flips to `failed` on a thrown error rather than hanging.
- `attempts/drizzleEvaluationResultRepository.ts` and
  `attempts/drizzleReportRepository.ts` (new): real Postgres persistence
  for evaluation results (word segments, issue candidates) and
  incorrect-feedback reports. Load-bearing correctness requirement, not
  optional: the worker and the API server are separate OS processes, so an
  in-memory repository in either one would never be visible to the other —
  results the worker wrote would silently vanish from the API's view.
- `db/schema/evaluation.ts`: added `status`,
  `audioQualityFailureReasons`, `audioQualityDurationSeconds` columns that
  `EvaluationResultRepository`'s interface already required but the table
  didn't have; migration `0003_volatile_baron_strucker.sql` generated and
  applied.
- `package.json`: added a `worker` script (`tsx watch src/worker.ts`) and
  the two `@aws-sdk` dependencies.

**Mobile (`apps/mobile`):**
- `src/api/uuid.ts`, `authClient.ts`, `sessionClient.ts`, `uploadFile.ts`
  (all new): guest-session bootstrap, profile/session creation, and a
  `fetch(localUri).blob()` → signed-URL `PUT` upload helper.
- `AppNavigator.tsx`: replaced the static "uploading isn't available yet"
  screen with a real `uploadRecording()` orchestration — bootstrap guest
  auth once, create a profile once (using the `profileType` the onboarding
  `ProfileType` screen already collected but the navigator was previously
  discarding via `onSelect={goNext}`), reuse one practice session per
  passage across retries (so retry creates a new attempt in the same
  session, matching Milestone C's stated requirement), create an
  idempotent attempt, request an upload URL, `PUT` the file, complete the
  attempt, then render the already-built-but-previously-unreachable
  `Processing` (polling) and `FeedbackReport` screens. Added an explicit
  `uploadError` state (`ErrorState` from `@qari/ui`) instead of letting a
  failed upload strand the user on a spinner.
- `FeedbackReport.tsx`: tap-to-hear now plays the passage's real reference
  audio (fetched via `ContentClient.getPassageDetail`) rather than a no-op
  button. Left honestly labeled "Tap to hear reference (full passage)"
  with an inline comment, since precise per-word playback isn't real yet
  (see §6's `referenceAudioSlices` gap above) — no fake precision.

**Verification actually performed (not claimed):**
- `services/api`: `pnpm lint && pnpm typecheck && pnpm test` — 98/98 passing
  (up from 93; +5 new session-route tests).
- `apps/mobile`: `pnpm typecheck && pnpm lint && pnpm test` — 46/46 passing,
  typecheck clean, no lint errors.
- No new native module was added on the mobile side (`expo-file-system` was
  already a dependency; everything else is `fetch`-based JS), so no
  `expo run:android` native rebuild was needed — a Metro JS reload is
  sufficient. Confirmed Metro (`:8081`), Postgres, Redis (`:6379`), MinIO
  (`:9000`/`:9001`), the API server (`:3000`), the worker process, and the
  inference service (`:8000`) were all running.
- Full pipeline exercised end-to-end via `curl` (phone intentionally
  disconnected per this session's instructions): guest session → create
  profile → create practice session → create attempt → request signed
  upload URL from the real MinIO-backed `S3ObjectStorage` → `PUT` a real
  16kHz mono 16-bit PCM WAV test fixture
  (`test-data/golden-audio/white_noise.wav` — a real signal-processing
  fixture, not fabricated recitation content, per Principle 1/7) →
  complete the attempt → poll `GET /v1/attempts/:id/evaluation` (returned
  `needs_rerecord` on the **first** poll — the worker had already picked
  the job off the BullMQ queue and processed it through the real inference
  service before the poll even ran) → `GET /v1/attempts/:id/feedback`
  returned a fully-formed report: `audioQuality.passed: false`,
  `failureReasons: ["noisy: estimated SNR 0.8dB < 5.0dB minimum"]`,
  `confidenceTier: "low"`, `retryRecommendation: "required"` — the correct,
  honest outcome for noise input (Principle 2's abstain behavior verified
  in the same call), not a fabricated success.
- What this run does *not* prove: real Quran recitation audio flowing all
  the way through forced alignment to a `completed` status with real word
  segments/issue candidates — that's blocked on the golden-recitation-audio
  gap already tracked above, not on anything built this session.

**Known gaps intentionally left open after this pass:**
- `AppNavigator.test.tsx` wasn't extended to cover the new
  recording→upload→processing→feedback flow (it still only exercises
  onboarding + tab navigation); the new orchestration logic is exercised
  indirectly via `Processing.test.tsx`/`FeedbackReport.test.tsx` (which
  already covered those screens standalone) plus this section's real
  `curl` walkthrough of the server side. Writing a fetch-mocked
  `AppNavigator` upload-flow test is the next piece of test-coverage debt
  here.
- Android AAC decode and QUL word-level audio slicing (both called out in
  §0/§6) remain open, tracked, out of scope for this pass.

## 9. Windows environment bring-up (2026-07-22, session 3)

First session on the new machine per `docs/LAPTOP_HANDOFF.md` — a genuine
platform switch (prior sessions were on a MacBook Pro), not just a new disk.
Environment brought up from a clean `pnpm install` through a full green
`pnpm test` run. Two real, reproducible bugs found; both fixed.

**Environment notes (not bugs, just Windows-specific deviations from the
handoff doc's Homebrew-based instructions):**
- `corepack enable` fails with `EPERM` on this machine (no write access to
  `C:\Program Files\nodejs`). Worked around with `npm install -g
  pnpm@9.15.9` (matches the `packageManager` field in root `package.json`)
  instead — installs to the user's npm prefix, no admin needed.
- Used `infrastructure/docker/docker-compose.yml` for Postgres/Redis/MinIO
  instead of native installs (Docker Desktop was already present; Homebrew
  obviously isn't an option on Windows). This is the first time that
  compose file has actually been exercised — closes the Milestone A gap
  that previously flagged it as unused (§1 table, updated above). All
  three services came up healthy on first try; migrations
  (`tsx src/db/migrate.ts`) and bucket creation (`mc mb`) both worked
  against it with no changes needed to the compose file itself.
- `services/api`'s scripts (`migrate.ts`, `server.ts`, etc.) read
  `process.env` directly — nothing in the repo loads `.env.development`
  into the process automatically (no `dotenv`, no `--env-file`). The
  handoff doc's instructions work on a shell that's had the file sourced
  into it some other way; on this machine, ran migrations via `set -a;
  source .env.development; set +a` in bash. Not a bug, just worth noting
  for whoever automates this next — `pnpm dev`/`pnpm worker` will need the
  same treatment or an explicit env loader added.
- System Python on this machine is 3.14.6; `services/inference/pyproject.toml`
  pins `torch==2.2.2`, which has no wheels for 3.14 (the pin was chosen for
  Intel macOS wheel availability, per its own comment — never validated
  against 3.14 either way). Installed Python 3.11.9 via `winget install
  Python.Python.3.11` and built the venv against that (`py -3.11 -m venv
  .venv`) instead of system Python. All 27 pytest tests passed, including a
  real HuggingFace checkpoint download and forced-alignment run.

**Bug found and fixed: committed Tanzil source file silently corrupted by
Windows line-ending normalization, breaking its checksum test.**
- `pnpm test` failed one real test:
  `importCommand.test.ts` — `imports the full corpus: 6236 ayat...` — with
  a SHA256 mismatch (`f9b19c25...` received vs `bf4f57b9...` expected).
- Root cause: this machine's global git config has `core.autocrlf=true`
  (the Windows default). On checkout, git silently rewrote
  `content-import/sources/tanzil-uthmani-v1.1.txt`'s LF line endings to
  CRLF, changing its bytes and thus its SHA256 — but `git status`/`git
  diff` show nothing, because git's own autocrlf-aware comparison
  considers the file unchanged. The corruption is only visible to code
  that reads the raw file bytes, like the checksum test (working as
  designed — this is exactly the class of bug ADR-003's checksum
  verification exists to catch, just from an unexpected direction: the
  repo's own checkout tooling, not a bad upstream export).
  `git show HEAD:<path> | sha256sum` matched the test's expected value
  exactly, confirming the committed blob was always correct.
- Fixed two ways: (1) `git config core.autocrlf false` scoped to this repo
  only (not the user's global config), and the file re-checked-out clean;
  (2) added a new `.gitattributes` — `content-import/sources/** -text`
  (never line-ending-normalize checksum-verified source dumps, on any
  platform or git config) plus a general `* text=auto eol=lf` and
  `*.wav`/`*.m4a` binary rules, so this can't silently recur for any future
  clone regardless of the developer's own git settings. This is a
  permanent fix, not just a workaround for this machine.
- After the fix: `services/api` 98/98, full monorepo `pnpm test` 253/253,
  `services/inference` pytest 27/27, `pnpm lint`/`pnpm typecheck` clean
  across all 8 workspaces (matches the 2026-07-05 test-health snapshot in
  §7 exactly — no regressions from the platform switch).
- `apps/mobile`'s Jest suite reproduced the already-documented flakiness
  (§1) under full-suite parallel load (`Library.test.tsx` timeout) but
  passed cleanly in isolation and on a second full-suite run — consistent
  with the existing, still-unexplained flake, not a new regression.
- One more oddity, not a bug: `pnpm lint`'s `@qari/api-contracts` task
  crashed once with a native libuv assertion
  (`UV_HANDLE_CLOSING`, exit `3221226505`) after printing a fully valid
  Redocly lint result — did not reproduce on a second run. Looks like a
  Windows-specific Node.js process-exit race in that tool, not a real lint
  failure; worth knowing about if it resurfaces in CI on a Windows runner.

**Still not done (carried over, unrelated to this session):** the actual
phone-side verification `LAPTOP_HANDOFF.md` calls for (recording → upload →
Processing → FeedbackReport on a physical/emulated Android device) — this
session only got the environment running, per the plan agreed with the
project owner before starting.

## 10. Android emulator bring-up + first real on-device upload attempt (2026-07-30, session 4)

Picked up where session 3 left off: the environment was running but had
never been exercised from a device. This session built an Android emulator
from scratch (none existed on this machine) and, for the first time,
actually drove a real recording through the app UI far enough to hit a new,
real bug in the upload path. That bug is root-caused below but **not fixed
yet** — deliberately stopping here for the day; fixing it is the first task
next session.

**Committed housekeeping first:** `.gitattributes` and the `docs/
IMPLEMENTATION_GAPS.md` §9 update from session 3 had been sitting uncommitted
on this machine for over a week. Committed as `8b9ad1f` before starting new
work.

**Android SDK/emulator did not exist on this machine — built from scratch:**
- Android Studio and `platform-tools` (`adb`) were present, but no
  `cmdline-tools`, no system images, and no AVD existed anywhere under
  `%LOCALAPPDATA%\Android\Sdk`.
- Downloaded `cmdline-tools` (build 15859902) directly from
  `dl.google.com/android/repository/` — note: `developer.android.com`'s own
  download page, when fetched through an AI web-summarizer, returned a
  plausible-looking but **wrong/hallucinated CDN URL**
  (`edgedl.me.gvt1.com/...`) that 404'd. Cross-checked the real URL against
  Google's machine-readable `repository2-3.xml` manifest instead of trusting
  the summarized page — worth remembering as a general pattern: don't trust
  an AI-summarized download link for a binary; verify against a
  machine-readable manifest or check the file itself (a 155MB zip that's
  actually a 1.4KB HTML 404 page is an easy, cheap check).
- Installed `platform-tools`, `platforms;android-34`,
  `system-images;android-34;google_apis;x86_64`, and `emulator` via
  `sdkmanager`; accepted licenses non-interactively.
- Created AVD `qari_test` (`avdmanager create avd -n qari_test -k
  "system-images;android-34;google_apis;x86_64"`). Note: `avdmanager`
  printed a scary-looking `Error: Could not load devices from
  .../devices.xml` on first create — this was a harmless side-effect of not
  passing `--device`; the AVD was created successfully anyway (confirmed via
  `emulator -list-avds` and a real boot). Boots in ~2-3 minutes cold
  (`-no-snapshot`).

**Content was missing from the persisted Postgres volume — this is what
`Library` was actually failing on, not a networking bug:**
- After bringing the stack up and building/installing the dev client
  (`expo run:android`, ~11 min first build, patched `expo-audio` Kotlin
  compiled cleanly), the Library tab showed "Failed to list passages (404)".
- Investigated as a possible Android-emulator-to-host networking issue
  first (Android emulators can't reach the host via `localhost`; fixed
  `apps/mobile/.env.development`'s `EXPO_PUBLIC_API_BASE_URL` from
  `http://localhost:3000/v1` to `http://10.0.2.2:3000/v1` — a real,
  necessary fix, but not the actual cause of the 404).
- `curl localhost:3000/v1/content/passages` from the host returned
  `{"code":"NOT_FOUND","message":"No approved content version is available
  yet"}` — a real, correct 404 from the content service itself. The
  Postgres *container* had persisted from session 3 (created "8 days ago"),
  but apparently no content version was ever imported/approved into it (or
  this is a different volume than assumed) — either way, the fix is the
  same: ran `content:import` (full 6236-ayah Tanzil corpus, checksum
  matched the known-good value), `content:approve`, `content:seed-mvp-
  passages` (23 passages created), `content:seed-placeholder-audio` (23/23
  seeded). Confirmed fixed by re-tapping Library in the running emulator —
  screenshot shows all 23 seeded passages listed.

**New real bug found: recording upload fails with "Recording file no
longer exists on device" — root-caused, not yet fixed.**
- After Library loaded, picked a passage, recorded on the emulator's
  (software) microphone, stopped, tapped Upload — got "Upload failed:
  Recording file no longer exists on device."
- First ruled out the emulator's audio codec/hardware as the cause: `adb
  logcat` around the recording window shows a completely healthy sequence —
  `MediaCodecSource (audio) starting` → ran for the full ~8s recording →
  `encoder (audio) stopping` → `puller (audio) reached EOS` → `source
  (audio) stopped`, no errors. (The `OMX service is not available` /
  `mediarecorder went away with unhandled events` lines nearby are red
  herrings — benign/expected on this system image, not the failure.) Also
  confirmed the previously-applied `expo-audio@0.3.5.patch` (session 2's fix
  for the inverted `isPrepared` condition) is correctly present in
  `node_modules/.pnpm/expo-audio@0.3.5.../AudioModule.kt` — so native
  recording is genuinely working now. This is a **second, previously
  undiscovered** bug in the same pipeline, one that only surfaces once
  capture succeeds far enough to reach the upload step — no prior session's
  `curl`-only verification could have caught it.
- Root cause: `expo-audio`'s native `AudioRecorder.uri` Kotlin property
  (`AudioModule.kt:316-318`, `Property("uri") { ref -> ref.filePath }`)
  returns a **bare OS filesystem path** (e.g.
  `/data/user/0/com.qariai.app/cache/Audio/recording-<uuid>.m4a`) — no
  `file://` scheme. `apps/mobile/src/audio/expoAudioRecorder.ts`'s
  `stopRecording()` (line 70-76) passes that raw value straight through as
  `localUri`, and `AppNavigator.tsx:139` calls `expo-file-system`'s
  `getInfoAsync(localUri)` on it directly. `expo-file-system`'s Android
  implementation (`FileSystemModule.kt`'s `slashifyFilePath`, line 68-77)
  only adds the `file:///` prefix to strings that **already** start with
  `file:` (regex `^file:/*`) — a path with no scheme at all is left
  untouched, so `Uri.parse()` yields `scheme == null`. `getInfoAsync` then
  treats a null-scheme URI as an **Android resource lookup**
  (`openResourceInputStream`, `FileSystemModule.kt:141-146`) instead of a
  real file path, which throws `FileNotFoundException` — caught and
  reported as `exists: false`. Hence "Recording file no longer exists,"
  even though the file is sitting right there on disk.
- **Fix identified, not yet applied** (stopping for the day before
  implementing): normalize the URI once, at the point of capture, in
  `ExpoAudioRecorder.stopRecording()` — prefix with `file://` if not already
  present. That single point feeds every downstream consumer (`getInfoAsync`
  in `AppNavigator.tsx`, `uploadLocalFile`'s `fetch(localUri).blob()` in
  `uploadFile.ts`, and `deleteAsync` in `discardRecording`), so fixing it
  there fixes the whole chain without touching call sites. **First task for
  next session** — implement, then re-run this exact recording → upload →
  Processing → FeedbackReport flow on the same running emulator to confirm.

**Environment state left at end of session (machine can be closed/slept
without losing anything):**
- All locally-started processes stopped cleanly: `services/inference`
  (uvicorn), `services/api` server, `services/api` worker, Metro/`expo run:
  android`, and the AVD (`qari_test`).
- Docker containers (`docker-postgres-1`, `docker-redis-1`,
  `docker-minio-1`) stopped (not removed) via `docker compose stop` — data
  volumes intact, including the now-imported/approved/seeded content, so
  next session does **not** need to repeat the `content:import`/`approve`/
  seed sequence.
- Not committed: the `expo-file-system` URI fix (not yet written), and the
  emulator/Android-SDK setup itself (nothing to commit — it lives under
  `%LOCALAPPDATA%\Android\Sdk` and `~/.android/avd`, outside the repo).

**Quick-start for next session (everything below already exists on this
machine — no re-downloading needed):**
1. Start Docker Desktop, then `docker compose -f
   infrastructure/docker/docker-compose.yml up -d` (containers restart with
   content already seeded).
2. `services/inference`: `.venv/Scripts/python.exe -m uvicorn app.main:app
   --host 127.0.0.1 --port 8000`.
3. `services/api`: `source .env.development` (`set -a; ...; set +a` in
   bash) then `npx tsx src/server.ts` and, separately, `npx tsx watch
   src/worker.ts`.
4. Emulator: `%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe -avd
   qari_test -no-snapshot` (~2-3 min cold boot).
5. `apps/mobile`: fix the URI bug above first, then `npx expo run:android`
   (native rebuild needed since it's a JS-only change this time — actually
   a plain Metro reload / `npx expo start --dev-client` would suffice once
   the dev client APK is already installed from this session; only rerun
   `expo run:android` if native code changes).

## 11. Two real bugs fixed and verified live; reached the known AAC-decode wall honestly (2026-08-01, session 5)

Picked up exactly where session 4 left off, per its own quick-start list —
environment came back up cleanly with no re-downloading. This session closed
out both the mic-permission UX complaint and the §10 upload bug, found and
fixed a *third*, previously-unknown bug in the same path, and for the first
time got a real on-device recording all the way through upload → queue →
worker → inference call before hitting the already-documented AAC/m4a decode
limitation (§0/§6) — an honest, expected stopping point, not a new failure.

**Bring-up:** Docker Desktop + `docker compose up -d`, `services/inference`
(uvicorn), `services/api` server + worker, `qari_test` AVD (warm boot, ~25s
this time), Metro (`npx expo start --dev-client` — dev client APK already
installed, no `expo run:android` needed since neither fix touched native
code). One snag: the dev-client's cached Metro connection failed with
"Failed to connect to /127.0.0.1:8081" on first launch — fixed with `adb
reverse tcp:8081 tcp:8081` (normally automatic, wasn't for this stale
session). Content, migrations, and MinIO bucket all persisted from session
4 — no re-seeding needed.

**Bug fixed: mic permission asked again on every visit to the Recite
screen, even after the OS had already granted it.**
- User-reported: "once microphone permission granted if user came second
  time it's asking again."
- Verified live before touching code: checked `dumpsys package
  com.qariai.app` — `RECORD_AUDIO: granted=true` at the OS level, persisted
  correctly across app restarts (Android's normal behavior). Tapped "Allow
  microphone" anyway to confirm — no native OS dialog appeared (as
  expected; Android never re-shows a granted permission's dialog). So the
  "asking again" the user was seeing was **the app's own idle screen**
  reappearing every time, not a real OS re-prompt: `Recite.tsx`'s state
  machine always mounts fresh into `idle` and forces a tap through "Allow
  microphone" regardless of actual OS grant status, because
  `AudioRecorder` (`apps/mobile/src/audio/audioRecorder.ts`) had no
  "check without prompting" method — only `requestPermission()`.
- Fix: added `getPermissionStatus(): Promise<'granted' | 'denied' |
  'undetermined'>` to the `AudioRecorder` interface, implemented via
  `expo-audio`'s `getRecordingPermissionsAsync()` (a real, exported,
  non-prompting status check — confirmed in `expo-audio`'s own build
  output) in `ExpoAudioRecorder`, and a matching implementation in
  `FakeAudioRecorder` for tests. `Recite.tsx` now checks this on mount and,
  if already `granted`, auto-fires `REQUEST_PERMISSION` →
  `PERMISSION_GRANTED` through the existing canonical state machine
  (`packages/domain`, untouched) instead of waiting for a tap — the idle
  screen still exists and is still reachable (denied/undetermined status
  leaves it exactly as before), it's just skipped when there's nothing
  left to ask.
- Test coverage: `Recite.test.tsx`'s three tests that used to always tap
  "Allow microphone" against a default (granted) `FakeAudioRecorder` were
  updated to construct `new FakeAudioRecorder('undetermined')` instead,
  preserving their original manual-tap coverage; added a new test asserting
  the granted case skips straight to "Start recording" with no
  "Allow microphone" button rendered at all. `apps/mobile`: typecheck
  clean, lint clean, 47/47 tests passing (46 previously + 1 new).
- Verified live on the emulator, twice: after granting permission once,
  force-stopped and relaunched the app (fresh onboarding, since onboarding
  state is separately in-memory-only per session — expected, unrelated,
  already documented) and navigated back to a passage's Recite screen —
  went straight to "Mic ready," no permission screen at all.

**Bug fixed (from session 4's root-cause): "Recording file no longer
exists on device."**
- Applied the fix identified and documented in §10: `expo-audio`'s
  Android `AudioRecorder.uri` returns a bare filesystem path with no
  `file://` scheme. `ExpoAudioRecorder.stopRecording()`
  (`apps/mobile/src/audio/expoAudioRecorder.ts`) now normalizes it —
  prefixes `file://` if not already present — before returning, fixing
  every downstream consumer (`getInfoAsync`, `uploadLocalFile`'s
  `fetch().blob()`, `discardRecording`'s `deleteAsync`) from the single
  point they all flow through.
- Verified live: recorded a real ~8s clip on the emulator, the
  `reviewLocal` screen's local-URI display now reads
  `file:///data/user/0/com.qariai.app/cache/Audio/recording-<uuid>.m4a`
  (previously the bare path), and tapping Upload no longer hits "Recording
  file no longer exists" — it proceeds to the actual network request.

**New bug found and fixed: presigned upload URL host unreachable from the
emulator.**
- With the above two fixes in place, Upload got further but then failed
  with "Network request failed." Root cause: `services/api/
  .env.development`'s `OBJECT_STORAGE_ENDPOINT=http://localhost:9000` is
  used both for the server's own S3 SDK calls to MinIO *and*, via
  `getSignedUrl`, baked directly into the presigned URL host handed back to
  the mobile client — but the client here is the Android emulator, which
  (same as the API-base-URL issue) cannot resolve `localhost` to the host
  machine. There's no separate "internal vs. public" endpoint config
  anywhere in `objectStorage.ts`/`server.ts`/`worker.ts` — a single value
  serves both roles.
- `10.0.2.2` (the fix used for `EXPO_PUBLIC_API_BASE_URL`) doesn't work
  here because this same value is *also* used by the server process
  running on the host — and `10.0.2.2` only resolves inside the emulator's
  own virtual network, not on the host itself. Confirmed the host's own
  LAN IP (`192.168.4.68`, the same address the API server already reports
  binding to at startup) works from both sides: `curl` from the host to
  `http://192.168.4.68:9000/minio/health/live` returned `200`, and this is
  the standard Android-emulator NAT path for reaching the host's LAN
  network (unlike `localhost`). Changed
  `OBJECT_STORAGE_ENDPOINT=http://192.168.4.68:9000` in `services/api/
  .env.development` and restarted the server + worker.
- **Caveat, not fully resolved**: this LAN IP is DHCP-assigned and can
  change (e.g., after reconnecting Wi-Fi, switching networks, or a lease
  renewal) — this is a same-session workaround, not a durable fix. A real
  fix would add a separate `OBJECT_STORAGE_PUBLIC_ENDPOINT`-style config
  distinct from the internal SDK endpoint, defaulting to the existing
  behavior in every environment except local-emulator dev. Not attempted
  this session (`services/api` has no code changes today, only the one
  `.env.development` value) — flagged here for whoever hits this again
  after a network change.
- Verified live: Upload succeeded past the network-request stage this
  time — confirmed via the worker log actually picking up and processing
  the job.

**Reached the known wall, honestly:** the worker log shows the real
recording was queued, dequeued, and sent to `services/inference`, which
correctly rejected it: `InferenceRequestError: ... "Could not decode
audio: Error opening <_io.BytesIO ...>: Format not recognised."` — this is
exactly the already-documented, already-tracked AAC/m4a-vs-`soundfile`
limitation from §0/§6 (ADR-007 scope), not a new bug. The app's own
"Failed to fetch feedback (404)" screen at this point is a legitimate 404
(no report exists for a `failed` attempt) but arguably poor UX — worth a
follow-up to show a clearer "processing failed" state instead of a raw
retry-404 screen, not attempted this session.

**Net effect: the full pipeline — record (real mic audio) → upload (real
MinIO PUT) → queue (real BullMQ) → worker dequeue → real inference-service
call — now works end-to-end on this Android emulator for the first time.**
Only the pre-existing, already-scoped-out AAC transcode gap stands between
this and a real `completed` evaluation with word-level feedback.

**Verification:** `apps/mobile` — `tsc --noEmit` clean, `eslint` clean,
`jest` 47/47 (was 46; +1 new permission-skip test). `services/api` code
unchanged this session (only a local `.env.development` value), not
re-run.

**Unresolved / next session:**
- Real Quran recitation → `completed` status with word-level segments is
  still unverified end-to-end — blocked on the Android AAC→WAV transcode
  (ADR-007) exactly as before. iOS (real WAV) remains the fastest path to
  proving that half of the pipeline, next time a Mac/iOS environment is
  available.
- `OBJECT_STORAGE_ENDPOINT`'s dual internal/public role (above) should get
  a real fix rather than a per-session LAN-IP workaround.
- `FeedbackReport`'s "Failed to fetch feedback (404)" on a `failed`
  attempt should probably render a distinct "processing failed" state
  instead of the generic retry-404 `ErrorState`.

## 12. Closed both §11 follow-ups: `OBJECT_STORAGE_ENDPOINT` split and the `failed`-attempt 404 UX (2026-08-01, session 5 continued)

Same session, continued after §11 — the user chose to close out both
smaller follow-up items now rather than go straight at the AAC transcode.

**`OBJECT_STORAGE_ENDPOINT`'s dual internal/public role — real fix, not
the LAN-IP workaround from §11:**
- Added `OBJECT_STORAGE_PUBLIC_ENDPOINT` (optional, `packages/config/src/
  env.ts`) — the host baked into URLs handed to clients (presigned
  uploads, reference audio), distinct from `OBJECT_STORAGE_ENDPOINT` (the
  server/worker's own direct S3 SDK calls). Falls back to
  `OBJECT_STORAGE_ENDPOINT` when unset, so every environment except
  local-emulator dev is unaffected.
- `S3ObjectStorage` (`services/api/src/attempts/objectStorage.ts`) now
  builds a second `S3Client` (`presignClient`) when a `publicEndpoint` is
  configured, and `createSignedUploadUrl` signs against that client
  instead of the internal one. Presigning is a local, offline signature
  computation — no network call happens on this second client, so this is
  the standard AWS SDK v3 pattern for making the presigner emit a
  different host than the one the server itself talks to.
- `server.ts` and `worker.ts` both now compute
  `env.OBJECT_STORAGE_PUBLIC_ENDPOINT ?? env.OBJECT_STORAGE_ENDPOINT` once
  and use it for `publicObjectBaseUrl` (reference-audio URLs) too — that
  string was quietly built from the plain internal endpoint before, which
  means "tap to hear reference audio" had the *exact same*
  localhost-unreachable-from-emulator bug as the upload URL; nobody had
  hit it yet only because no session had gotten far enough to test
  playback on the emulator. Same root cause, same fix, closed in the same
  pass.
- This machine's `services/api/.env.development` now reads
  `OBJECT_STORAGE_ENDPOINT=http://localhost:9000` (reverted to the
  correct, fast, canonical value — no reason for the server's own calls
  to go through the LAN IP) plus
  `OBJECT_STORAGE_PUBLIC_ENDPOINT=http://10.0.2.2:9000` (the standard,
  stable Android-emulator-to-host alias — no longer DHCP-fragile like the
  §11 LAN-IP workaround it replaces).
- `services/api` and `packages/config`: typecheck clean, lint clean,
  102/102 tests passing (98 + 4 in `packages/config`, one new test added
  for the optional var parsing correctly and defaulting to `undefined`).
  `packages/config` needed a `tsc` rebuild for `services/api`'s typecheck
  to see the new field — it consumes `packages/config`'s compiled `dist/`,
  not source directly; a stale build produced a confusing "property does
  not exist" error before rebuilding.

**`FeedbackReport`'s 404-on-`failed`-attempt — real fix:**
- `Processing`'s `onDone` callback already received the real terminal
  status (`'completed' | 'needs_rerecord' | 'failed'`) but
  `AppNavigator.tsx` discarded it and always transitioned to the
  `feedback` state, which unconditionally calls `GET /v1/attempts/:id/
  feedback` — a genuine 404 for `failed` attempts (no report was ever
  generated), surfaced to the user as a confusing "Retry / Failed to fetch
  feedback (404)" screen.
- Added a new `processingFailed` branch to `AppNavigator`'s `PracticeState`
  union. `onDone` now branches on the actual status: `'failed'` goes to
  the new state (a dedicated `ErrorState`: "Processing failed — We
  couldn't evaluate this recording. Please try recording again."),
  `'completed'`/`'needs_rerecord'` still go to `feedback` as before (both
  have a real report — `needs_rerecord` is the audio-quality-gate
  rejection path, which does return a report body, per session 2's `curl`
  walkthrough).
- Deliberately did not add new fetch-mocked test coverage for this exact
  branch in `AppNavigator.test.tsx` — that file has no fetch mocking for
  *any* part of the upload/processing/feedback flow yet (a gap already
  flagged in §8's "known gaps," unchanged since). Adding full mocking
  infrastructure to cover one three-way branch was judged disproportionate
  to this fix; verified instead via `tsc`/`eslint`/the existing 47-test
  suite (no regressions) plus live confirmation on the emulator, which is
  how this exact file's behavior has been validated every session so far.
  Building out real `AppNavigator` fetch-mock coverage remains open,
  unchanged from §8.
- Verified live end-to-end on `qari_test`: recorded → uploaded (both §11
  fixes still holding) → worker picked up the job → inference rejected the
  AAC audio exactly as before (identical `Format not recognised` error,
  confirming this is still the known ADR-007 wall, not a new regression)
  → app now shows "Processing failed / We couldn't evaluate this
  recording. Please try recording again." instead of the old retry-404
  screen.
- `apps/mobile`: typecheck clean, lint clean, 47/47 tests passing (no
  change in count — no new tests added, per the coverage decision above).

**Net effect:** all three items from §11's "unresolved" list are now
closed except the AAC transcode itself, which remains the real blocker to
a genuine `completed` evaluation and is out of scope for a quick pass
(native module work, ADR-007).

## 13. The AAC transcode wall is gone — Android now captures real WAV, verified end-to-end (2026-08-01→02, session 6)

Closes the one item §12 left open. Full technical detail, root causes, and
the alternatives evaluated live in **ADR-008**
(`docs/adr/008-android-raw-pcm-capture.md`) — this section is the session
narrative; ADR-008 is the durable record.

**What shipped:** Android no longer records via `expo-audio`'s
`MediaRecorder` (AAC/m4a only, per ADR-007) at all. A new local Expo module,
`apps/mobile/modules/qari-audio-recorder`, captures raw 16kHz mono 16-bit
PCM directly via Android's `AudioRecord` API and hand-writes a WAV file —
no encode step exists, so there is nothing to transcode and nothing to get
wrong in a decode step. iOS is untouched (`expo-audio`'s `LINEARPCM` path
already worked). `apps/mobile/src/audio/createAudioRecorder.ts` selects the
implementation by `Platform.OS`.

**The path there was not straight — three real dependency/tooling bugs
were hit and resolved, each with its own root-cause investigation:**

1. Tried `@siteed/audio-studio` (MIT, npm) first — architecturally the
   right approach, already built and tested. Version `3.2.1` doesn't
   compile against this project's `expo-modules-core@2.2.3` (a genuine
   nullable-parameter override mismatch in its device-switching code).
   `3.1.1` compiles but its bundled C++ audio-analysis code (unused by
   this app) hits Windows' 260-char `MAX_PATH` limit during its own CMake
   build — a *different* failure from the `expo-modules-core` one §11
   already worked around via `virtual-store-dir-max-length`, and not
   fixable the same way (confirmed via direct reproduction; a `subst`
   drive-letter workaround was also tried and failed, since CMake/ninja
   resolve substituted drives back to their real path internally). Pivoted
   to writing the module from scratch — genuinely low-friction since
   `apps/mobile/android/` is already a committed, autolinked native
   project.
2. **A real, independent bug in `expo@52.0.49` itself**, found while
   getting the from-scratch module's first build to compile — unrelated to
   the `AudioRecord` decision, but blocking verification of it. `expo`'s
   own `react-native.config.js` self-references
   `expo-modules-autolinking/exports` to find the project root; when
   *other* packages' configs are evaluated by `expo-modules-autolinking`'s
   own sandboxed config loader, that self-reference fails silently (caught,
   returns `null`), and a fallback path kicks in that fabricates a
   plausible-but-wrong native class reference
   (`expo.core.ExpoModulesPackage` instead of the real
   `expo.modules.ExpoModulesPackage`) from the package's Android namespace
   plus the first `ReactPackage`-implementing class file it finds. This
   would affect any project on this exact `expo`+`expo-modules-autolinking`
   version pair, on any OS — it surfaced now only because this session was
   the first time `apps/mobile/android/app/build`'s generated
   `PackageList.java` got regenerated from a clean state. Fixed with
   `patches/expo@52.0.49.patch` (pnpm patch), inlining the two-line
   "find nearest `package.json`" logic instead of the fragile
   cross-package `require`. Diagnosed by directly reproducing the exact
   Node command `settings.gradle` runs and bisecting from there — not
   guessed.
3. Even after that patch was confirmed correct via direct command
   reproduction, the Gradle build kept failing with the *same* wrong value
   until a **third, separate cache** —
   `apps/mobile/android/build/generated/autolinking/autolinking.json`
   (root `android/build/`-scoped, distinct from `app/build/` and from the
   Gradle daemon, which was also stopped and didn't help alone) — was
   deleted. This build has (at least) three independent layers that can
   hold a stale autolinking result; clearing one or two isn't sufficient
   after any change that affects autolinking.
4. **A fourth real bug, found only once real audio finally reached
   `fetch()`**: Kotlin's `File.toURI().toString()` produces a *single*-slash
   `file:/data/...` URI. `expo-file-system`'s `getInfoAsync` tolerates
   this, so the app got past the file-existence check — but React Native's
   `fetch()` (used to read the local file for upload) does not, failing
   with `Failed to construct 'Response': The status provided (0) is
   outside the range [200, 599]`. Fixed in `qariAudioRecorder.ts` by
   normalizing to `file:///...` before returning — the same
   normalize-once pattern as the earlier `expoAudioRecorder.ts` bare-path
   fix (§10-11), this time catching a stricter consumer than that fix's
   `getInfoAsync` case exercised.

**Verified end-to-end on `qari_test` (emulator), for the first time this
project has ever gotten this far on Android:** recorded a real clip → real
16kHz mono 16-bit PCM WAV (`file:///data/user/0/com.qariai.app/cache/Audio/
recording-*.wav`, confirmed via the reviewLocal screen) → uploaded
successfully → BullMQ queue → worker dequeued → `services/inference`
**decoded the WAV with no error** (the `Format not recognised` failure
from every prior session's Android attempt is gone) → audio quality gate
ran → worker log read `evaluation job 3 (attempt ...) completed` (not
`failed`) → app displayed "We're not confident enough to flag anything
here... Please try again: mostly silent: 97.6% of the clip is silence." —
the correct, honest `needs_rerecord` outcome for the emulator's silent
virtual microphone, and exactly the Principle 2 abstain behavior working
as designed, not a bug.

**What this does *not* yet prove:** a genuine `completed` evaluation with
real word-level segments/issue candidates — that needs actual recitation
audio, which requires either a physical Android device or an emulator
configured with host-audio passthrough, neither attempted this session.
That is now the **only** remaining gap between this pipeline and a fully
proven Milestone C on Android.

**Also fixed in the same session, smaller and independent (see commit for
full detail):** the worker's `tsx watch` process died mid-session when
`pnpm install --force` (needed for the `virtual-store-dir-max-length`
change) churned `node_modules` out from under it — restarted cleanly, no
code change needed, just a reminder that `tsx watch` doesn't survive a
full dependency reinstall.

**Verification:** `apps/mobile` — `tsc --noEmit` clean, `eslint` clean
(including the new `modules/qari-audio-recorder` directory), `jest` 47/47.
Full monorepo (`turbo run test --force`): 12/12 workspace tasks green —
`@qari/api` 98/98, `@qari/ui` 23/23, `@qari/mobile` 47/47, plus
`@qari/domain`/`@qari/content-schema`/`@qari/config`/`@qari/admin`
unchanged. No regressions from the `pnpm install --force` reinstall or the
two new patches (`expo-audio@0.3.5.patch` confirmed still applied
correctly post-reinstall; `expo@52.0.49.patch` is new this session).

**Unresolved / next session:**
- Prove a real `completed` evaluation with word-level feedback — needs
  real recitation audio on a physical Android device, or emulator
  host-audio passthrough.
- `apps/mobile/modules/qari-audio-recorder` doesn't handle audio focus
  loss, phone calls, or Bluetooth device switching mid-recording (ADR-008
  Consequences) — `@siteed/audio-studio` has real tests for these; this
  project's own module doesn't yet. Worth hardening before this is
  considered production-ready rather than just device-verified.
- 16kHz `AudioRecord` initialization has no fallback-and-resample path if
  a real device can't support it (ADR-008 Consequences) — not hit on the
  emulator, unverified on physical hardware.
- ~~`AppNavigator.test.tsx` still has no fetch-mocked coverage of the
  upload/processing/feedback flow (carried since §8, unchanged).~~ —
  **closed same session, see §14.**

## 14. Closed the `AppNavigator` test-coverage gap carried since §8 (2026-08-02, session 6 continued)

While waiting on a physical Android device to become available for real-
audio verification (§13's remaining gap), picked up the other item flagged
as ready to go: real fetch-mocked coverage of the record → upload →
processing → feedback flow, which had been manual/live-device-only since
Milestone C first shipped.

**Root cause of why this was hard before:** unlike every other screen in
this app (`Library`, `PassagePreview`, `Recite`, `Processing`,
`FeedbackReport`), `AppNavigator` constructed all of its dependencies
(`ContentClient`, `AuthClient`, `AttemptsClient`, `SessionClient`,
`createAudioRecorder()`, `uploadLocalFile`) internally via `useMemo` —
it was the one place in the codebase that didn't follow the
dependency-injection-via-props pattern everything else already uses for
testability, so there was no way to hand it a fake client the way
`Library.test.tsx`/`Processing.test.tsx`/`FeedbackReport.test.tsx` already
do for their own screens.

**Fix:** added `AppNavigatorProps` (all fields optional, each defaulting
to the real construction it already had) — `contentClient`,
`audioRecorder`, `authClient`, `attemptsClient`, `sessionClient`,
`uploadFile`, and `pollIntervalMs` (threaded through to `Processing`, so
tests don't wait on real 2-second poll intervals). Zero production
call sites changed (`src/App.tsx` still renders `<AppNavigator />` with no
props). Two small supporting fixes:
- `__mocks__/expo-file-system.ts` was missing `getInfoAsync` entirely
  (only `deleteAsync` existed) — `AppNavigator`'s upload orchestration
  calls it directly and would have crashed immediately. Added as a
  `jest.fn()` (not a plain function) defaulting to `{ exists: true, size:
  12345 }`, so individual tests can override it via `mockResolvedValueOnce`
  if a future test needs to exercise the "file no longer exists" path.
- Two `console.error` "not wrapped in act(...)" warnings surfaced during
  development (not test failures) — both traced to `Recite.tsx`'s own
  async permission-check effect resolving in the gap between two separate
  `await`ed test-helper calls, outside any `waitFor`'s `act()` wrapping.
  Fixed by moving the "wait for Recite to settle" call to close that gap
  at the source rather than suppressing the warning.

**Five new tests**, covering exactly the transitions that were previously
only proven by hand on a real device:
1. The full happy path: Library → passage → record → upload → processing
   (polls to `completed`) → feedback report renders.
2. A `failed` terminal status routes to the dedicated "Processing failed"
   screen (§12's fix) — proving `AppNavigator` never calls
   `getFeedback()` for a status with no report, not just that the screen
   exists in isolation.
3. `needs_rerecord` (the audio-quality-gate rejection path) routes to the
   real `FeedbackReport` screen with its report body, distinct from
   `failed`.
4. An error thrown mid-orchestration (`authClient.createGuestSession`
   rejecting) surfaces as "Upload failed" with the real error message,
   not a silent failure or crash.
5. A `Retry` reuses the same practice session within one passage
   (`practiceSessionRef` reuse logic) rather than creating a new one —
   asserted via a call counter on the fake `SessionClient`, proving the
   specific Milestone C requirement ("Retry creates a new attempt in the
   same session") that was previously only implied by code reading, never
   tested.

**Verification:** `apps/mobile` — `tsc --noEmit` clean, `eslint` clean,
`jest` 52/52 (was 47; +5 new, 0 removed, 0 regressed). Full monorepo not
re-run this pass (no non-`apps/mobile` files touched).

**Deliberately not done:** did not add coverage for `discardRecording`/
`Re-record` mid-flow, pause/resume during an `AppNavigator`-driven
recording, or the "file no longer exists" upload-failure branch now that
`getInfoAsync` is mockable — all reachable extensions of this same
fixture, left for whenever they're actually needed rather than added
speculatively.

## 15. First real-device recitation reached a genuine `completed` evaluation; found and fixed a real deviation-detection bug along the way (2026-08-03, session 7)

With the physical Android device connected (§13), tried Al-Fatiha
(1:1-7) first: a 5.12s recording against a 29-word/7-ayah target produced
degenerate all-`[0,0]`-timing alignment. Root cause: the recording was too
short to contain the full passage at natural pace, not a code bug — full
Al-Fatiha takes 15-30+ seconds. Moved to a shorter surah instead of
diagnosing further, since a duration mismatch isn't fixable in code.

Al-Ikhlas (112:1-4, 19 words) at 14.24s passed the audio quality gate and
produced genuine, non-degenerate forced-alignment word timings correctly
spread across the full recording, proving the capture → upload → queue →
decode → forced-alignment path is healthy end-to-end on real audio. But
every one of the 19 words was flagged as a deviation candidate regardless
of content, and the app correctly abstained ("We weren't confident enough
to flag anything specific") rather than show any of them.

Root-caused and fixed in `app/deviation.py`
(`docs/adr/009-deviation-char-level-diff.md` is the durable record — read
that first, not this summary, if picking this up again): the free/
unconstrained CTC decode used to detect deviations never predicted the
model's `|` word-boundary symbol for this continuous, pause-free
recitation, so the old word-level diff split the whole utterance into one
"word" and flagged all 19 target words as substitutions by construction.
Fixed by diffing at the character level instead, with word ownership taken
from the KNOWN target (not the free decode) — removes the dependency on
the model ever emitting an explicit boundary. Added a regression test
(`test_missing_boundary_token_does_not_falsely_flag_every_word`); all 28
`services/inference` tests pass.

Re-verifying against the same real recording after the fix still flagged
all 19 words — but for a different, deeper reason this time, confirmed by
inspecting the actual character-level diff: the free decode only overlaps
the target text by ~18% (a handful of short recognized fragments, e.g.
"قُل"), despite high (~0.97 mean) frame-level model confidence. This is
consistent with the model checkpoint
(`HamzaSidhu786/wav2vec2-base-word-by-word-quran-asr`) being fine-tuned for
word-level *forced* alignment rather than open transcription — exactly the
distinction CLAUDE.md §3 already draws. Forced alignment (used for word
timings) is unaffected; only the free decode used for deviation candidates
is weak. **Not fixed this session** — this is Milestone H golden-corpus
calibration scope (per CLAUDE.md §4), and the existing safety nets
(low-confidence abstain + `ALL_LABELS_DISABLED` default) already prevent
this weak signal from reaching any user as a false accusation, so nothing
unsafe is live today.

**Net result:** the last milestone-relevant gap from §13
("proving a genuine `completed` evaluation with real word-level feedback
needs actual recitation audio") is closed — pipeline verified end-to-end
on real device audio with sensible timings — but a new, correctly-scoped
Milestone H item is now documented: the free-decode-based deviation signal
needs real calibration work (better decoding strategy, a checkpoint suited
to open decoding, or a redesign of the signal to not need a free decode at
all) before any issue label can be safely enabled.
