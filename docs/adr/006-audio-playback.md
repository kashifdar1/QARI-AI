# ADR-006: Reference Audio Playback (Adjustable Speed, No Pitch Distortion)

- Status: Accepted
- Date: 2026-07-03

## Context

Milestone B's Passage Preview needs adjustable-speed reference-audio
playback so a learner can slow down a reciter's audio to follow along,
without the pitch dropping (the classic "slowed-down tape" effect), which
would make the recitation sound wrong and undermine its use as a learning
reference.

## Decision

**`expo-audio`**, using its pitch-correcting playback rate API (set the
playback rate together with pitch-correction enabled, rather than a naive
resampling approach).

### Why `expo-audio`, not `expo-av`

`expo-av`'s `Audio.Sound` API is Expo's older audio/video module and is in
the process of being superseded by two focused modules, `expo-audio` and
`expo-video`; Expo's own SDK 52+ guidance is that `expo-av` is
deprecated for new work. `expo-audio` is the actively-developed
replacement and is what a project starting fresh on SDK 52 should adopt,
even though (per its own versioning at the time of writing) it's a newer,
faster-moving module than `expo-av`.

### Why this satisfies "no pitch distortion"

Both `expo-av` and `expo-audio` expose the platform's native time-stretch
(pitch-preserving) algorithms — iOS via `AVAudioEngine`'s
`AVAudioUnitTimePitch`, Android via `PlaybackParams` with
`setPitch`/`setSpeed` set independently — as long as pitch correction is
explicitly requested when the rate is changed (the naive "just change
playback rate" path pitches the audio down/up along with speed, which is
what must be avoided). `expo-audio`'s player exposes this as a
pitch-correction-quality option alongside its rate setter, which is the
API surface the Passage Preview screen's speed control (Milestone B task
4) is built against.

### Verse-range playback

The reference audio object is one file per passage (whole-surah, for the
MVP passage set — see `content-import/src/content-import/mvpPassageSeed.ts`),
not one file per ayah. Verse-range selection (task 4: "verse-range
selection UI") seeks within that single file using ayah-level timing
offsets — which do not exist yet (see `docs/STUBS.md`, QUL timing data is
blocked on licensing). Until timing data lands, verse-range selection UI
can be built and shown, but seeking is necessarily approximate
(passage-start only) — documented as a known gap, not silently
implemented against fabricated timing numbers.

## Consequences

- `apps/mobile` depends on `expo-audio` rather than `expo-av` going
  forward; no code in this repo may import `expo-av`.
- The exact `expo-audio` version pinned in `apps/mobile/package.json` is a
  placeholder (`~0.2.0`, matching the SDK-52-era preview release line) —
  a maintainer must run `npx expo install expo-audio` in a real Expo
  project to get the exact SDK-52-compatible resolution before this
  dependency is exercised on a device; this has NOT been verified by
  installing/running the module in this environment (no simulator/Expo Go
  runtime available here — see the milestone risk notes).
- Because reference audio is currently the `PLACEHOLDER_AUDIO` silent stub
  (docs/STUBS.md), pitch-correction behavior cannot be perceptually
  verified (silence has no pitch to distort) until a real reciter is
  cleared; the API choice is verified by documentation/platform capability
  only at this milestone.

## Alternatives considered

- **`expo-av`**: rejected as deprecated for new work under SDK 52+ despite
  being the more battle-tested option; would create migration debt shortly
  after shipping.
- **A dedicated third-party audio library (e.g. `react-native-track-player`)**:
  rejected — adds a second native audio stack alongside whatever
  Expo's own modules already provide for the app's other audio needs
  (recorder in `packages/domain`'s FSM assumes Expo-managed audio I/O per
  ADR-004), with no capability this app needs that `expo-audio` lacks.
