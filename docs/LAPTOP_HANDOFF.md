# Laptop Handoff Notes — 2026-07-21

Written so picking this up on a different machine doesn't require
re-deriving anything from git history. Read this, then
`docs/IMPLEMENTATION_GAPS.md` §8 for the full technical before/after.

## What state this branch is in

`feature-qari-ai` now has a real, working (not stubbed) upload → queue →
evaluate → feedback pipeline. This was built and verified entirely
server-side via `curl` on the original laptop — the pipeline has **not**
yet been exercised from a physical phone with a real recitation recording.
That's the next thing to do, on whichever machine has the phone.

## One-time setup on the new laptop

You need four local services running before the app will do anything
beyond onboarding. None of this is in Docker Compose yet — everything was
installed and run natively via Homebrew last session:

1. **Postgres 15+** — `services/api`'s `DATABASE_URL` env var must point at
   it. Run migrations: `cd services/api && npx tsx src/db/migrate.ts`.
2. **Redis** — `brew install redis && brew services start redis` (or
   `redis-server` directly). Used by BullMQ for the evaluation queue.
3. **MinIO** — `brew install minio && minio server --address :9000
   --console-address :9001 <data-dir>`. Create the bucket named in
   `OBJECT_STORAGE_BUCKET` (check `services/api/.env.development`, which is
   gitignored — you'll need to recreate it, see below).
4. **services/inference** (Python/FastAPI) — has its own `.venv`; the
   Wav2Vec2 model checkpoint (`HamzaSidhu786/wav2vec2-base-word-by-word-quran-asr`)
   downloads from HuggingFace on first run if not cached, so first startup
   on the new machine will be slower and needs network access.

Then, in `services/api`:
- `pnpm dev` (or `npx tsx src/server.ts`) for the API server on `:3000`.
- `pnpm worker` (added this session — `tsx watch src/worker.ts`) for the
  BullMQ consumer. **This is a separate process from the API server** —
  both need to be running, and both talk to the same Postgres, so a
  Docker-less native setup means starting them independently every time.

And `apps/mobile`: `npx expo start --dev-client` (Metro on `:8081`), plus
the Expo dev-client build on the physical device/emulator — **not Expo
Go**, per CLAUDE.md's resolved decision (native audio modules aren't
available in Expo Go).

## `.env.development` files are gitignored — recreate them

`apps/mobile/.env.development`, `services/api/.env.development`, and
`apps/mobile/ios/.xcode.env.local` did **not** transfer with this push
(intentionally — see `.gitignore`). You'll need to recreate them on the
new machine. Check `packages/config/src/env.ts` for the full list of env
vars `services/api` expects (`DATABASE_URL`, `REDIS_URL`,
`OBJECT_STORAGE_ENDPOINT`/`BUCKET`/`ACCESS_KEY_ID`/`SECRET_ACCESS_KEY`,
`JWT_SECRET`, `INFERENCE_SERVICE_URL` — the last one is new this session).

## `pnpm patch` for expo-audio — make sure this actually applies

`patches/expo-audio@0.3.5.patch` fixes a real inverted-condition bug in
`expo-audio`'s Android native module (`AudioModule.kt`) that silently
prevented `MediaRecorder.start()` from ever being called. It's registered
in the root `package.json`'s `pnpm.patchedDependencies`, so a plain `pnpm
install` on the new machine should apply it automatically — but this
**requires a native rebuild** (`expo run:android`) to take effect, since
it's a compiled Kotlin change, not JS. If recording silently produces a
0-byte or immediately-failing file on the new machine, this patch not
having taken effect (e.g., stale native build cache) is the first thing
to check.

## What to actually test once running (the phone-side verification that's still missing)

1. Onboarding → pick a passage → record a real recitation on-device.
2. Confirm the upload actually happens now (previously it stopped at
   "Recording saved... uploading isn't available yet" — that screen is
   gone, replaced with a real upload flow in `AppNavigator.tsx`).
3. Watch it land in `Processing` (polling `GET
   /v1/attempts/:id/evaluation`), then `FeedbackReport`.
4. **Known, already-documented limitation to expect on Android**: the
   on-device recorder produces `.m4a` (AAC), and
   `services/inference`'s `soundfile`-based decoder can't parse AAC. A
   real Android recording will very likely reach the worker and fail
   decode there — an honest failure, not evidence something's newly
   broken. iOS's recorder already emits real 16kHz mono WAV and should
   work end-to-end without this problem. See
   `docs/IMPLEMENTATION_GAPS.md` §6 for the ADR-007-tracked fix (a real
   on-device AAC→WAV transcode step, not attempted yet).
5. If it does reach `completed` (iOS, or an Android transcode fix lands
   later): verify the feedback report shows real word segments/issue
   candidates, not just the audio-quality-gate rejection path that the
   `curl` verification exercised last session (that only proved the noisy
   audio → `needs_rerecord` path, not a real ASR pass through forced
   alignment on genuine recitation).

## Things intentionally left undone (not oversights)

- No CI pipeline runs any of this yet — lint/typecheck/test were run
  manually each session.
- `AppNavigator.test.tsx` doesn't cover the new upload/processing/feedback
  flow with fetch mocks; the screens are covered individually
  (`Processing.test.tsx`, `FeedbackReport.test.tsx`) plus the server-side
  `curl` walkthrough documented in `docs/IMPLEMENTATION_GAPS.md` §8.
- Mobile auth is a fresh in-memory guest session per app launch — no
  persisted identity across restarts yet.
