# ADR-008: Android Raw-PCM Capture (Supersedes ADR-007's Android Transcode Plan)

- Status: Accepted, device-verified end-to-end
- Date: 2026-08-01 (decision); verified working on-device 2026-08-02

## Context

ADR-007 planned a `MediaExtractor`/`MediaCodec`-based native module to
transcode Android's AAC/m4a `MediaRecorder` output to 16kHz mono 16-bit PCM
WAV after each recording, and explicitly flagged that plan as unverified —
no Android environment existed at the time to build or test it. That gap
became concrete once a real Android emulator was available this session:
`services/inference`'s `soundfile`-based decoder cannot parse the AAC/m4a
`expo-audio` (`MediaRecorder`-backed) produces on Android, so every real
Android recording reached the worker and failed decode (see
`docs/IMPLEMENTATION_GAPS.md` §10-§12 for the session history that led
here).

No Mac was available to prove the pipeline via iOS instead (iOS's
`expo-audio` path already emits real WAV natively — ADR-007's "no transcode
needed" half was already correct and remains unchanged by this ADR), so the
Android side had to be solved directly.

## Decision

**Capture raw PCM directly via Android's `AudioRecord` API instead of
transcoding AAC after the fact.** This is a stronger fix than ADR-007's
plan, not just an alternative implementation of it: `AudioRecord` hands
back raw PCM samples with no codec in the path, so the app never encodes to
AAC at all on Android — there is nothing to transcode, and nothing to get
wrong in a decode step.

Two problems with ADR-007's `MediaCodec` transcode plan, found while
evaluating it against this decision, are the specific reasons this is
better than "implement ADR-007 as written" now that Android is available
to test against:

1. **AAC encoder priming-sample silence.** AAC encoders insert silent
   priming frames (commonly 1024-2112 samples) at the start of the encoded
   stream, which must be detected and trimmed during decode or every
   recording carries a leading-silence offset — silently biasing word-onset
   timing in the forced-alignment output. `AudioRecord` capture has no
   encoder in the path, so this failure mode cannot occur.
2. **Lossy round-trip.** Transcoding AAC→WAV feeds the alignment model
   audio that already went through one lossy encode, working against this
   project's own release gates (word-alignment accuracy ≥95%,
   high-confidence precision ≥90% — CLAUDE.md §4). Raw PCM capture is
   lossless from the microphone to the uploaded file.

**Implementation: a from-scratch local Expo module
(`apps/mobile/modules/qari-audio-recorder`), pure Kotlin, no native C++.**
`@siteed/audio-studio` (MIT, npm) was tried first — it's architecturally
exactly this decision, already built with real instrumented tests for the
expensive edge cases (audio focus loss, device disconnect, backgrounding)
— but was rejected after hitting two real, blocking problems on this
project's actual toolchain, not just theoretical risk:

1. **3.2.1 doesn't compile against this project's `expo-modules-core`
   version.** Its device-switching fallback code
   (`AudioRecorderManager.kt`) declares `override fun reject(code:
   String?, ...)` (nullable `code`) against an interface that requires
   non-nullable `code: String` in `expo-modules-core@2.2.3` (Expo SDK
   52) — a genuine source incompatibility, not a config issue. Confirmed
   absent in `3.1.1`, which was tried next.
2. **`3.1.1` compiles but its bundled native C++ (audio-analysis features
   this app never uses — FFT/mel-spectrogram) fails Windows' `MAX_PATH`
   (260 char) limit during CMake/ninja's build**, even after fixing the
   *same* limit in `expo-modules-core`'s own C++ build via pnpm's
   `virtual-store-dir-max-length` setting (shortens `.pnpm` store
   directory names — a real, kept fix, see Consequences). The library's
   CMake output mirrors the full absolute source path as a nested build
   directory, re-triggering the limit regardless of how short the
   package's own store directory name is. A Windows `subst` drive-letter
   workaround was tried and failed too — CMake/ninja resolve `subst`
   drives back to their real path internally, so the shortened prefix
   never reaches the actual build step.

Both are dependency-quality problems, not evidence the underlying
architectural approach (raw PCM via `AudioRecord`) is wrong — and this
project's own `android/` is already a committed, autolinked native project
(`useExpoModules()` in `settings.gradle`, which re-scans `node_modules`
*and* local `modules/` for Expo native modules on every Gradle build, not
just at `expo prebuild` time), which is exactly what made writing the
module ourselves the lower-risk path once the dependency stopped being
free. `apps/mobile/modules/qari-audio-recorder/android/src/main/java/expo/modules/qariaudiorecorder/QariAudioRecorderModule.kt`
implements `AudioRecord`-based capture on a dedicated thread
(`Process.THREAD_PRIORITY_URGENT_AUDIO`), a hand-written 44-byte RIFF/WAVE
header with size backfill via `RandomAccessFile` on stop (the same
technique `@siteed/audio-studio` and
`services/api/src/content-import/placeholderAudio.ts` both use), and the
same `Permissions.{ask,get}ForPermissionsWithPermissionsManager` calls
`expo-audio` itself uses (verified by reading `expo-audio`'s own Kotlin
source rather than guessing the API). No CMake/C++ build step exists in
this module at all — `create-expo-module`'s default local-module template
has none unless explicitly added — so this entire class of build failure
cannot recur here.

**Wiring is platform-conditional, not a replacement of the iOS path**:
`apps/mobile/src/audio/createAudioRecorder.ts` returns `QariAudioRecorder`
on Android and keeps `ExpoAudioRecorder` (`expo-audio`, `LINEARPCM`) on
iOS, which was already correct per ADR-007 and needed no change. No new
Android manifest permissions were needed — `RECORD_AUDIO` was already
present from the existing `expo-audio` integration.

## Consequences

- ADR-007's Android section (the `MediaCodec` transcode plan) is
  superseded and will not be implemented — its iOS section stands
  unchanged. ADR-007's file is left as-is for historical record, with a
  pointer to this ADR.
- `expo-audio`'s Android recording path (`MediaRecorder`, still used by
  `ExpoAudioRecorder`) is no longer used on Android at all in the app, only
  on iOS. The `expo-audio@0.3.5.patch` fix from an earlier session (a real
  bug in `MediaRecorder`'s `record()` wrapper) is now dead code on Android
  specifically — harmless to keep (still correct, still needed for the
  patch to apply cleanly if `ExpoAudioRecorder` is ever used on Android
  again), not worth removing for a one-line patch.
- **No new runtime dependency** — `apps/mobile/modules/qari-audio-recorder`
  is local, first-party code, so there's no third-party maintenance risk,
  version-compatibility risk, or unused-feature-surface tradeoff to accept.
  The cost is the opposite one: this project now owns the
  `AudioRecord`-plus-WAV-header code and its edge cases (audio focus loss,
  device disconnect, backgrounding) directly, rather than inheriting
  another maintainer's already-tested handling of them. None of those edge
  cases are handled in this pass — `startRecording`/`pauseRecording`/
  `resumeRecording`/`stopRecording` assume an uninterrupted foreground
  recording session, matching what the app's recorder state machine
  (`packages/domain`) already exercises, but a phone call or Bluetooth
  device switch mid-recording is unhandled. Worth hardening before this is
  considered production-ready, not just device-verified.
- **`pnpm`'s `virtual-store-dir-max-length=60` (root `.npmrc`) is a kept,
  permanent fix**, independent of the library rejection above — it fixed a
  real Windows `MAX_PATH` failure in `expo-modules-core`'s own C++ build
  (`react-native`'s deeply-nested, peer-dependency-suffixed `.pnpm` store
  directory name), which is a pre-existing risk for any contributor on
  Windows regardless of this ADR's outcome, not specific to the rejected
  dependency.
- 16kHz is within Android's platform-supported range for `AudioRecord`, but
  the platform only formally *guarantees* 44100Hz across every device —
  16kHz is near-universal on real hardware but not contractually
  guaranteed the same way. `QariAudioRecorderModule.beginCapture` calls
  `AudioRecord.getMinBufferSize` and throws a clear, catchable error if
  16kHz mono 16-bit PCM isn't supported, rather than silently falling back
  to a different rate — matches this project's existing "abstain/fail
  loud rather than silently degrade" posture (Principle 2), but there is
  no fallback-and-resample path if this is ever hit on a real device.
- `services/inference`'s existing `EXPECTED_SAMPLE_RATE` check
  (`app/model.py`, enforced in `app/evaluate.py`'s `evaluate_attempt`) and
  typed `AudioDecodeError` (wrapping the raw decode failure message) already
  give a loud, diagnosable server-side failure if a client ever sends the
  wrong format — no server-side change was needed for this ADR.
- **`patches/expo@52.0.49.patch` (new, pnpm patch): a real, independent bug
  in `expo`'s own `react-native.config.js`, found while getting this
  module's first Gradle build to compile — nothing to do with the
  `AudioRecord` decision itself, but it blocked verifying it.** Android's
  Gradle build failed with `cannot find symbol: class ExpoModulesPackage`
  in a generated `PackageList.java` importing `expo.core.ExpoModulesPackage`
  — not a real class anywhere in `node_modules`. Root cause: `expo`'s
  `react-native.config.js` does `require('expo-modules-autolinking/exports')`
  to find the project root — a self-reference back into the very package
  that's about to evaluate this file. When `expo-modules-autolinking`'s own
  config loader (`reactNativeConfig/config.ts`'s `requireConfig`) evaluates
  *other* packages' `react-native.config.js` files via `require-from-string`
  with a sandboxed/mocked `module.paths`, this self-reference fails to
  resolve — silently, since `requireConfig` catches any error and returns
  `null`. A `null` config falls through to `androidResolver.ts`'s fallback:
  compute an import path from the package's own Android `namespace`
  (`expo.core`, from `expo/android/build.gradle`) and the name of the first
  file it finds implementing `ReactPackage` (`ExpoModulesPackage`, a
  legacy-arch compatibility shim `expo` ships) — producing a plausible but
  wrong class reference. Confirmed by direct reproduction of the exact
  command `apps/mobile/android/settings.gradle` runs, both before and after
  the fix. Patched by inlining the two-line "find nearest package.json"
  logic directly into `expo`'s `react-native.config.js` instead of the
  fragile cross-package `require`. This is an upstream bug independent of
  Windows/pnpm and would affect any project on this exact `expo@52.0.49` +
  `expo-modules-autolinking@2.0.8` pair, on any OS — it likely went
  unnoticed here across earlier sessions only because `apps/mobile/android/
  app/build`'s generated `PackageList.java` was never regenerated from a
  clean state until this session deleted it while debugging the unrelated
  `MAX_PATH` failures above.
- **A second, separate stale-cache trap along the way**: even after the
  patch was confirmed correct via direct command reproduction, the Gradle
  build kept failing with the *same* wrong value until
  `apps/mobile/android/build/generated/autolinking/autolinking.json` (a
  root-level, `android/build/`-scoped cache distinct from `app/build/`,
  and distinct from Gradle's daemon — stopping the daemon alone did not
  help) was deleted. Worth remembering: this project's Android build has
  *three* independent layers that can hold a stale autolinking result —
  the Gradle daemon, `android/app/build/generated/autolinking/`, and
  `android/build/generated/autolinking/` — clearing only one or two is not
  sufficient after an autolinking-affecting change.
- **A third real bug, found only once real audio finally reached
  `fetch()`**: Kotlin's `File.toURI().toString()` (used for `fileUri` in
  `QariAudioRecorderModule.kt`, matching the pattern this ADR cited from
  `@siteed/audio-studio`) produces a *single*-slash `file:/data/...` URI,
  not the standard triple-slash `file:///data/...`. `expo-file-system`'s
  `getInfoAsync` tolerates this (its `slashifyFilePath` regex matches any
  number of slashes after `file:`), so the app got past the file-existence
  check that caught the *previous* session's bare-path bug in
  `expoAudioRecorder.ts` — but React Native's `fetch()` (used by
  `uploadFile.ts`'s `uploadLocalFile` to read the local file for upload)
  does not tolerate it, failing with `Failed to construct 'Response': The
  status provided (0) is outside the range [200, 599]`. Fixed in
  `qariAudioRecorder.ts`'s `stopRecording()` by normalizing to
  `file:///...` before returning — the same "normalize once at the single
  point every consumer flows through" approach as the earlier
  `expoAudioRecorder.ts` fix, this time catching a stricter consumer
  (`fetch()`) that the previous fix's consumer (`getInfoAsync`) didn't
  exercise.
- **Verified end-to-end on `qari_test` (emulator)**: a real recording now
  flows capture → real 16kHz mono 16-bit PCM WAV → upload → BullMQ queue →
  worker dequeue → `services/inference` decode (succeeds — no more `Format
  not recognised`) → audio quality gate → feedback, with the worker log
  reading `evaluation job N (attempt ...) completed` instead of `failed`.
  The one still-open, expected gap: the emulator's virtual microphone
  captures near-silence, so the quality gate correctly returns
  `needs_rerecord` ("mostly silent: 97.6% of the clip is silence") rather
  than a `completed` result with real word-level segments — this is the
  quality gate working as designed (Principle 2: abstain rather than
  fabricate), not a pipeline defect. Proving a genuine `completed`
  evaluation with real word-level feedback needs actual recitation audio
  captured on a physical device or an emulator with host-audio
  passthrough configured — not attempted this session.

## Alternatives considered

- **Implement ADR-007's `MediaCodec` transcode plan as originally
  written**: rejected now that it could actually be evaluated against a
  real Android target — see the two correctness problems above (priming-
  sample silence, lossy round-trip), both of which are structural to any
  transcode-after-record approach, not implementation details that could be
  fixed within that plan.
- **`ffmpeg-kit-react-native`**: rejected for the same reason ADR-007
  already rejected it, now confirmed further deteriorated — its native
  binaries were pulled from every package registry (Maven Central,
  CocoaPods, npm) in 2025 following its retirement; forks that exist are
  single-maintainer and pinned to the retired version. Also 30-70MB of
  binary size and GPL/patent licensing risk in its `-gpl` variants, for a
  problem `AudioRecord` solves in zero additional native binary bytes.
- **`@siteed/audio-studio`** (both `3.2.1` and `3.1.1`): tried first,
  rejected after hitting real compile/build failures on this project's
  actual toolchain (Expo SDK 52's `expo-modules-core@2.2.3`; Windows +
  pnpm) — see Decision above for the specifics. Not a theoretical risk
  avoided in advance; both failure modes were reproduced and diagnosed
  before moving on. Worth revisiting if a future version fixes both (the
  `reject()` signature bug and the bundled C++ build), since it still has
  real instrumented tests for edge cases this project's own module doesn't
  yet handle (see Consequences).
- **Enable Windows `LongPathsEnabled` further, or move the repo to a
  shorter root path**: `LongPathsEnabled` was already `1` in the registry
  and the failure still occurred — the bundled Android SDK `ninja.exe`
  doesn't honor it. Moving the repository to a shorter path (e.g.
  `C:\qari`) would work but is disruptive and machine-specific; rejected
  in favor of `virtual-store-dir-max-length`, which fixes the root cause
  (long generated directory names) for every contributor regardless of
  where they clone the repo.
