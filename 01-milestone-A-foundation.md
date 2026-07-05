# Milestone A — Repository Foundation & Design System

Read `CLAUDE.md` fully. Milestone 0 artifacts must already exist and pass.
State this milestone's scope and acceptance criteria back before starting.

## Scope

Turn the skeleton into a working development foundation: CI, environments,
design tokens, shared UI primitives, i18n plumbing, and the Expo dev-client
app shell. No Quran content, no recording, no evaluation yet.

## Tasks

1. **Tooling & CI**
   - Root scripts: `lint`, `typecheck`, `test`, `build` wired through Turborepo.
   - GitHub Actions workflow: install → lint → typecheck → test → build for
     mobile (Expo prebuild check), api, and inference (ruff + mypy + pytest).
   - docker-compose for local Postgres + Redis + MinIO (S3-compatible).
   - `.env.example` per service; config loading via `packages/config` with
     zod-validated schemas; separate dev/staging/prod naming conventions.

2. **Design system (`packages/ui`)**
   - Theme tokens: green-led palette with restrained gold accent, light and
     dark themes, spacing/radius/typography scales.
   - Arabic typography: bundle KFGQPC Uthmanic Script Hafs with its license
     file; scalable type presets (`arabic-xl`, `arabic-reader`, etc.).
   - Urdu: Nastaliq-capable font stack with a documented Android fallback.
   - Core accessible components: Button, Card, Screen, Text (with `lang` and
     direction awareness), IconButton, ProgressBar, EmptyState, ErrorState,
     LoadingState, PermissionDeniedState, OfflineBanner.
   - Storybook (or Expo-compatible equivalent) rendering every component in
     LTR-en, RTL-ar, RTL-ur, light and dark.

3. **Mobile app shell (`apps/mobile`)**
   - Expo dev-client project boots on iOS simulator + Android emulator.
   - Typed navigation per `docs/mobile-architecture.md`: onboarding stack
     (language select → profile type → trust/consent explanation), learner
     tabs (Home, Library, Progress, Settings) with placeholder screens using
     the shared empty/loading/error states.
   - i18n: en/ur/ar resource files, runtime language switch, full RTL flip
     verified for ar and ur (screenshots or rendering tests).
   - Consent explanation screen text must include: "AI feedback can be
     uncertain and does not replace a qualified teacher" (localized, human
     review of ur/ar strings flagged as a TODO in docs/STUBS.md if machine
     drafted).

4. **API shell (`services/api`)**
   - Fastify app with health route, OpenAPI served from the contract,
     request validation middleware, structured logging that provably cannot
     log signed audio URLs (write the redaction test now), and error envelope.
   - Auth scaffold: guest session issuance + account creation + guest→account
     upgrade path (per contract). Object-level authorization helper with tests.

5. **Inference shell (`services/inference`)**
   - FastAPI app with `/health` and a versioned `/v1/evaluate` route that
     currently returns a typed `STUB` response (per Stub Policy: named stub,
     logged, listed in docs/STUBS.md with unblocking condition = Milestone C).

## Acceptance criteria

- CI green on a clean clone; paste the real command outputs.
- Mobile app boots and language switch to ur/ar flips layout correctly.
- Design-system components have RTL + dark-mode rendering tests.
- Redaction test proves audio URLs never reach logs.
- ≥ 80% coverage on `packages/domain` and auth/authorization logic.
- File tree diff + honest risks section. Do not begin Milestone B.
