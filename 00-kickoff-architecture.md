# Milestone 0 — Architecture Kickoff (no application code yet)

Read `CLAUDE.md` in full before doing anything. Confirm you will operate under
its Non-Negotiable Principles, Resolved Decisions, and Stub Policy.

## Scope

Produce the foundational architecture artifacts ONLY. Do not implement app
features in this milestone. Every artifact is a real file committed to the repo.

## Deliverables

1. **ADRs** in `docs/adr/`:
   - `001-architecture-baseline.md` — monorepo, service boundaries, why forced
     alignment against known text (not open transcription) is the ML baseline.
   - `002-database-and-migrations.md` — choose drizzle-kit or Prisma migrate,
     with rationale; this choice is then fixed.
   - `003-content-versioning.md` — how QuranContentVersion, checksums, and
     review status work; how a content release is cut and rolled back.
   - `004-audio-capture-and-storage.md` — 16 kHz mono WAV pipeline, on-device
     transcode approach in Expo dev-client, signed upload flow, retention.
   - `005-confidence-policy.md` — tier semantics, per-profile-age policy
     (child profiles get stricter abstention), feature-flag gating of labels.

2. **Monorepo skeleton file tree** — actual directories with package.json /
   pyproject stubs (real, installable, no fake content), matching the layout in
   CLAUDE.md §3. `pnpm install` must succeed at the root.

3. **Database schema** — a real migration file set creating: User, Profile,
   GuardianRelationship, ConsentRecord, QuranContentVersion, Passage,
   ReciterAudio, PracticeSession, Attempt, EvaluationJob, EvaluationResult,
   WordSegment, IssueCandidate, ProgressAggregate, TeacherReview,
   ContentIssueReport, AuditEvent, Entitlement, OfflinePack, Notification.
   Include: idempotency key on Attempt, model_bundle_version +
   content_version_id on EvaluationResult, report linkage from
   ContentIssueReport → EvaluationResult, retention_state on Attempt.

4. **OpenAPI outline** in `packages/api-contracts/openapi.yaml` covering:
   auth (signup/login/guest-upgrade), sessions, attempts (+ idempotency
   header), signed upload, attempt complete, evaluation status/result,
   evaluation feedback report, content passages, progress, consent
   (grant/revoke per purpose), data export, data delete, and a reserved
   teacher-review namespace. Version everything under `/v1`.

5. **Mobile navigation map + recorder state machine** in
   `docs/mobile-architecture.md` — typed stack/tab structure for onboarding,
   learner, parent, and settings flows; the canonical state machine from
   CLAUDE.md §6 as an XState (or equivalent) definition file in
   `packages/domain` with exhaustive transition unit tests.

6. **Milestone backlog** in `docs/backlog.md` — Milestones A–J with acceptance
   criteria, mapped to PRD requirement IDs (create the ID scheme).

## Acceptance criteria

- `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass at root
  (tests may be minimal but must include the recorder state machine tests).
- Migrations apply cleanly to a fresh local Postgres (docker-compose provided).
- OpenAPI file validates with a real validator; show the command and output.
- No Quranic Arabic anywhere in the repo yet (content import comes later).
- End with the file tree, real test output, and an honest risks section.
