# ADR-004: Audio Capture and Storage

- Status: Accepted
- Date: 2026-07-03

## Context

CLAUDE.md fixes the capture format (16 kHz mono 16-bit PCM WAV) and the
mobile stack (Expo dev client, not Expo Go, for native audio modules), and
requires: the local recording is never deleted until the server confirms
persistence or the user explicitly discards it; short-lived signed URLs;
raw audio URLs never logged.

## Decision

### On-device pipeline (Expo dev client)

1. Recording is captured via `expo-av` (or its dev-client-only successor at
   implementation time) into whatever container the platform recorder
   natively emits — commonly AAC/m4a on both iOS and Android — because
   requiring the OS recorder to emit raw PCM WAV directly is unreliable
   across devices.
2. Immediately after `STOP` (recorder state machine, CLAUDE.md §6), an
   on-device transcode step converts to 16 kHz mono 16-bit PCM WAV before
   the file is treated as the canonical local artifact. This requires a
   native transcode module (`ffmpeg-kit-react-native` or platform
   AVFoundation/MediaCodec bridge) — which is exactly why a dev client build
   is required; Expo Go cannot include this native module.
3. The **original recorder-native file is kept alongside the transcoded WAV
   until the transcode is verified** (duration and non-silence sanity
   check), then the original is discarded — this is an implementation
   detail inside `recording`/`paused`→`reviewLocal`, not a state the FSM
   exposes, since from the FSM's perspective there is exactly one
   `localUri` once `STOP` fires.
4. From `reviewLocal` onward, the transcoded WAV is `localUri` and is
   subject to the FSM's persistence invariant: never deleted except via
   explicit `DISCARD`/`RETRY_RECORD` (pre-upload, user-initiated) or
   `CLEAR_LOCAL` (post `SERVER_COMPLETED`/`SERVER_NEEDS_RERECORD`, i.e.
   after `serverConfirmedPersistence` is true). See
   `packages/domain/src/recorder/recorderMachine.ts`.

### Upload flow

1. Client calls `POST /v1/attempts/{attemptId}/upload-url` with
   `contentType: audio/wav` and `sizeBytes`. API authorizes (the attempt
   belongs to a profile the caller guardian owns), then returns a signed PUT
   URL scoped to one object key, short TTL (`SIGNED_URL_TTL_SECONDS`,
   default 300s — see `packages/config`).
2. Client PUTs the WAV directly to object storage (S3-compatible, private
   bucket) — the API process never proxies audio bytes.
3. Client calls `POST /v1/attempts/{attemptId}/complete`. API verifies the
   object exists (HEAD request) and matches expected size before
   transitioning the attempt out of `uploading` and enqueuing the BullMQ
   evaluation job — this is the point `SERVER_*` events become available to
   the client FSM.
4. **The signed URL and any object storage path are never written to
   application logs.** Structured logger config (Milestone A) redacts any
   field named `*Url`/`*url` under the audio/upload namespace at the
   transport layer, not just by convention at call sites.

### Retention

`Attempt.retention_state` (`active` → `pending_deletion` → `deleted`)
drives a scheduled deletion job (Milestone D+) that enforces the default
short retention window from Principle 6. Deletion is idempotent and
irreversible; `retention_state` transitions are themselves `AuditEvent`
rows.

## Consequences

- The FSM's persistence invariant is provable independent of the transcode
  detail: tests in `recorderMachine.test.ts` operate purely on the
  post-`STOP` `localUri`, which is correct because the transcode-and-verify
  step happens before `STOP` is dispatched to the machine, not after.
- Object storage never sees a non-WAV or non-16kHz/mono/16-bit file, so
  `services/inference` can assume a fixed input format and skip a
  server-side transcode/validation stage for the common case (it may still
  defensively re-validate headers).

## Alternatives considered

- **Upload the native (AAC/m4a) file and transcode server-side**: rejected
  — CLAUDE.md's format decision is explicit that on-device transcode is
  the approach; it also avoids uploading a larger, non-canonical file over
  potentially poor mobile networks before transcoding it away server-side.
- **Proxy uploads through the API** instead of signed direct-to-storage
  URLs: rejected — unnecessary API compute/bandwidth cost and a larger
  blast radius if the API process is compromised; direct signed upload
  keeps raw audio off the API process entirely.
