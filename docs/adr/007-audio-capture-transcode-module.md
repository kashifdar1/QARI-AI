# ADR-007: On-Device Recording Transcode Module

- Status: Accepted (platform-asymmetric; Android side unverified — see Consequences)
- Date: 2026-07-03

## Context

CLAUDE.md §3 and ADR-004 fix the capture format at 16 kHz mono 16-bit PCM
WAV. ADR-004 anticipated needing an on-device transcode step because "the
OS recorder to emit raw PCM WAV directly is unreliable across devices."
Milestone C requires naming the actual module. Recording itself uses
`expo-audio` (ADR-006 already chose it over `expo-av` for playback; using
the same module's recorder keeps one audio stack in the app rather than
two).

## Decision

**Platform-asymmetric, because the two OS recorders have genuinely
different native capabilities:**

### iOS: no transcode needed

`expo-audio`'s recording options expose `IOSOutputFormat.LINEARPCM`
directly (confirmed in the module's own `RecordingConstants.ts`), with
`sampleRate: 16000`, `numberOfChannels: 1`, `linearPCMBitDepth: 16`,
`linearPCMIsFloat: false`, and `extension: '.wav'`. iOS's `AVAudioRecorder`
can write a real WAV/LPCM file directly at capture time — there is no
AAC-then-transcode step on this platform. This eliminates an entire
failure mode (a transcode step that could fail or introduce latency)
for roughly half the target platforms.

### Android: transcode is still required

Android's `MediaRecorder` (which `expo-audio` wraps for Android recording)
has no raw WAV/PCM `OutputFormat` — only container formats like MPEG-4,
3GPP, AMR, WEBM. Android recording therefore still lands in AAC/m4a first,
exactly as ADR-004 anticipated, and needs an on-device transcode to 16kHz
mono 16-bit PCM WAV before upload.

**Recommended approach: a small custom native module (Kotlin) using
Android's built-in `MediaExtractor` + `MediaCodec` to decode the AAC to raw
PCM samples, a simple linear resampler to 16kHz mono, and a hand-written
44-byte WAV header (the same technique already used for real audio in
`services/api/src/content-import/placeholderAudio.ts`) — rather than
`ffmpeg-kit-react-native`.**

**Why not ffmpeg-kit-react-native**, which is the module most guides
reach for: its upstream FFmpeg-based native binaries were retired by the
maintainer in a licensing dispute (early 2025), making it a
no-longer-actively-maintained dependency for new projects — an
unacceptable long-term risk for a capture path this central to the
product. `MediaCodec` is a first-party Android API with no such risk, at
the cost of writing more native code ourselves instead of calling a
higher-level library.

## Consequences

- **Not implemented or verified in this session.** There is no
  Android emulator/device, no Xcode/Android Studio native build
  environment, and no way to write or run Kotlin here. This ADR records
  the *decision and rationale*, not working code — `apps/mobile`'s
  recorder screen (Milestone C task 1) is built against
  `packages/domain`'s already-tested recorder state machine and treats
  "the local file after STOP is a valid 16kHz/mono/16-bit WAV" as an
  assumption to be validated once this native module exists, not
  something proven end-to-end on a real device here.
- iOS capture path is lower-risk (no custom native code, first-party
  `expo-audio` option) and should be implemented/validated first.
- The Android native module is new code a maintainer must write, build,
  and test against real devices (various OEM `MediaCodec` implementations
  are known to have quirks) before Milestone C's recorder can be
  considered device-verified on Android.

## Alternatives considered

- **ffmpeg-kit-react-native**: rejected — maintenance/licensing risk (see
  above), despite being the most commonly documented solution in older
  React Native audio tutorials.
- **Record at 44.1kHz/stereo on both platforms and resample server-side**:
  rejected — uploads a larger file over the user's network for no benefit
  (the model and forced-alignment pipeline only ever consume 16kHz mono),
  and defers a client-side problem to the server without a client-side
  format guarantee, meaning `services/inference`'s explicit `EXPECTED_SAMPLE_RATE`
  check (`app/model.py`) would have to accept multiple formats instead of
  strictly rejecting anything but the one contracted format (ADR-004: "so
  `services/inference` can assume a fixed input format").
- **A JS-only resampling library**: rejected for the decode step — decoding
  AAC in pure JS is impractically slow on-device; `MediaCodec` uses the
  hardware/OS decoder.
