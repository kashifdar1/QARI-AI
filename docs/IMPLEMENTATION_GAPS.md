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
