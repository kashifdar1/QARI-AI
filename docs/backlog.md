# Milestone Backlog (A–J)

## Requirement ID scheme

`PRD-<AREA>-<NNN>`, three-digit, gaps allowed for later insertion. Areas:

| Area code | Domain |
|---|---|
| AUTH | Accounts, guest sessions, auth |
| CONTENT | Quran content import/versioning, passage browsing |
| PRACTICE | Session/attempt lifecycle, recorder |
| EVAL | Forced alignment, evaluation pipeline |
| FEEDBACK | Confidence-tiered feedback policy, evidence UI |
| PROGRESS | Progress tracking, streaks, rewards |
| CONSENT | Consent records, purpose-based opt-in |
| PRIVACY | Data export/delete, retention |
| TEACHER | Human-review escalation |
| I18N | Localization, RTL |
| OFFLINE | Offline packs, sync |
| ADMIN | Reviewer/admin portal |
| INFRA | CI/CD, observability, deployment |

Every acceptance criterion below cites the IDs it satisfies. IDs are
introduced the milestone they're first needed; later milestones may extend
an earlier ID's scope (noted inline) rather than minting a near-duplicate.

---

## Milestone A — Foundation

CI, design system, i18n/RTL, app + service shells (already partially
scaffolded in Milestone 0; A wires them into a real CI pipeline and adds the
first working screens/routes).

**Scope**
- GitHub Actions (or equivalent) CI: install, lint, typecheck, test, and
  `redocly lint` on every PR; drizzle migration dry-run against a CI Postgres
  service container.
- `packages/ui` grows from tokens into a minimal component set (Button,
  TextInput, ScreenContainer) with RTL layout tests for `ur`/`ar`.
- i18n scaffolding (e.g. `i18next` or `expo-localization` + a typed
  translation-key checker) for en/ur/ar; Urdu Nastaliq font stack bundled
  and shaping-tested on Android.
- `apps/mobile` navigator wired to the route params from
  `docs/mobile-architecture.md` with placeholder screens (no real data).
- `services/api` gets real auth routes (signup/login/guest-upgrade) against
  the schema in `services/api/src/db/schema`.

**Acceptance criteria**
- CI is green on a clean PR; a deliberately broken lint/type/test fails CI
  (proof, not assertion). — INFRA-001
- `pnpm --filter @qari/mobile start` boots the Expo dev client and renders
  the tab navigator. — I18N-001, PRACTICE-001 (navigation only, no recorder yet)
- Switching locale to `ur` or `ar` flips layout direction and renders
  Nastaliq without clipping on an Android emulator. — I18N-002
- `POST /v1/auth/signup`, `/login`, `/guest-upgrade` implemented and
  contract-tested against `openapi.yaml`. — AUTH-001, AUTH-002, AUTH-003
- Authorization test: guardian A cannot fetch guardian B's profile via any
  authenticated route. — AUTH-004

---

## Milestone B — Content

Verified Quran content import, versioning, passage browser.

**Scope**
- Import job (ADR-003): pulls Tanzil.net Uthmani text, verifies checksum,
  writes a `QuranContentVersion` row with content stored in a
  pipeline-only-writable table; evaluates QUL word-timing data for
  licensing.
- Content review CLI/route to move `pending_review` → `approved`, and to cut
  a release (`released_at`).
- Passage browser screen backed by `GET /v1/content/passages` /
  `GET /v1/content/passages/{id}`.
- Reciter audio ingestion for the single MVP-cleared reciter, with license
  metadata stored on `reciter_audio`.

**Acceptance criteria**
- Import job run against a real Tanzil.net export produces a
  checksum-matching `QuranContentVersion`; a deliberately corrupted export
  is rejected before any row is written. — CONTENT-001
- No Quranic Arabic string literal exists anywhere outside content storage
  populated by this job (grep-based CI check). — CONTENT-002
- Passage browser lists real imported passages, all tagged
  `riwayah: hafs_an_asim`. — CONTENT-003
- Reciter audio playback works end-to-end with a verified, recorded license
  reference. — CONTENT-004

---

## Milestone C — Vertical Slice

Full practice loop with a REAL forced-alignment baseline (no stubbed
inference — see CLAUDE.md §7 Stub Policy; this is the milestone most likely
to be tempted into a stub, per the README's flagged failure mode).

**Scope**
- `services/inference`: load a Quran-fine-tuned wav2vec2/Whisper-family
  checkpoint (or best available Arabic ASR checkpoint if a Quran-specific
  one is unavailable — documented as a stub per §7 if so, with the
  unblocking condition being checkpoint availability), CTC forced alignment
  against known target text, word timings + issue candidates out.
- `services/api`: wires attempt-complete → BullMQ job → inference call →
  `EvaluationResult`/`WordSegment`/`IssueCandidate` persistence →
  confidence-tier feedback report (ADR-005).
- Mobile: real recorder screen using
  `packages/domain/recorderMachine`, upload flow, feedback report screen
  with evidence playback, reference-audio comparison.
- Golden corpus: first consented clips in `test-data/golden-audio`, used to
  compute the §4 thresholds for the first time.

**Acceptance criteria**
- End-to-end: record → upload → real alignment → feedback report, on a
  physical or simulator device, no mocked inference call. — PRACTICE-002,
  EVAL-001, FEEDBACK-001
- Word-alignment accuracy ≥ 95% measured on the golden corpus (adult
  subset); reported number, not asserted. — EVAL-002
- High-confidence precision ≥ 90%, false "definite mistake" rate < 2% on
  golden corpus; both label tiers remain feature-flagged OFF until these
  numbers are met (ADR-005). — FEEDBACK-002, FEEDBACK-003
- P95 feedback latency ≤ 15s for ≤60s passages, measured against the golden
  corpus. — EVAL-003
- If any component is a stub, it is named `*.stub.ts`/`*_stub.py`, logs
  `STUB`, and is listed in `docs/STUBS.md` with an unblocking condition —
  milestone is not declared complete with a silently substituted stub. —
  INFRA-002

---

## Milestone D — Offline Reliability

**Scope**
- `OfflinePack` download/sync for passages + reference audio + word timings.
- Recorder FSM robustness under real network loss / app-kill during
  `uploading`/`queued` (resume-on-relaunch).
- Local queue for attempts created while offline.

**Acceptance criteria**
- Killing the app mid-upload and relaunching resumes from `reviewLocal` with
  the local file intact (extends the Milestone 0 FSM invariant to real OS
  process death, not just in-memory `APP_BACKGROUNDED`). — PRACTICE-003
- A downloaded `OfflinePack` allows a full practice attempt with zero
  network calls until upload. — OFFLINE-001
- Sync reconciliation test: two attempts queued offline both reach the
  server exactly once (idempotency key proves this). — OFFLINE-002

---

## Milestone E — Profiles & Consent

**Scope**
- Guardian-managed child profile CRUD, `GuardianRelationship` UI.
- Consent grant/revoke UI wired to `/v1/consent`.
- COPPA/GDPR-K review pass: no third-party ad/analytics SDK on any
  child-profile code path (build-time check, not just policy).

**Acceptance criteria**
- Creating a child profile requires an authenticated guardian; a profile
  cannot be created without one. — CONSENT-001
- Revoking `audio_model_training` consent immediately excludes that
  profile's future recordings from any training-data export path (test
  against the export job, not just the API response). — CONSENT-002,
  PRIVACY-001
- Static/build-time scan confirms zero third-party ad/analytics SDK imports
  reachable from any child-profile-only screen. — CONSENT-003

---

## Milestone F — Progress & Rewards

**Scope**
- `ProgressAggregate` computation job (triggered on attempt completion).
- Progress screen, streaks; reward mechanics designed with **no public
  leaderboards** (Principle 5).
- `Notification` delivery for streak reminders / evaluation-ready, with
  `isChildSafe` enforced server-side for child profiles.

**Acceptance criteria**
- Progress aggregate updates within one job cycle of `SERVER_COMPLETED`. —
  PROGRESS-001
- No leaderboard or public-ranking feature exists in the shipped screens
  (design + code review checklist item, verified by grep for any
  cross-profile ranking query). — PROGRESS-002
- Child-profile notifications are always `isChildSafe: true`; a test proves
  a child-profile notification with a non-safe kind is rejected at write
  time. — PROGRESS-003

---

## Milestone G — Localization Hardening

**Scope**
- Full string audit across en/ur/ar; human review of Urdu/Arabic UI strings
  (human-owner task per README, tracked here as a gate).
- RTL edge cases: mixed-direction screens (Arabic Quran text embedded in an
  RTL Urdu UI vs. LTR English UI), number formatting, date formatting.

**Acceptance criteria**
- Every user-facing string has en/ur/ar translations; CI fails on any
  missing key. — I18N-003
- RTL visual regression suite (screenshot diff) passes for ur and ar on the
  three highest-traffic screens (Practice, FeedbackReport, Progress). —
  I18N-004
- Quran text embedding renders correctly (Uthmani script, correct direction)
  inside both RTL (ur/ar) and LTR (en) surrounding UI. — I18N-005

---

## Milestone H — AI Quality Harness

**Scope**
- Expanded golden corpus (more consented clips, more accents/child audio).
- Automated calibration report: per-tier observed precision/recall against
  the golden corpus, gating the feature flags from ADR-005.
- Child-audio-specific precision study — the explicit unblocking condition
  for ever moving a child profile off the "no high tier" policy.

**Acceptance criteria**
- Calibration report is regenerated in CI on every model-bundle version
  bump and archived. — EVAL-004
- Child-audio precision study published with enough data to make an
  evidence-based (not guessed) decision on `DEFAULT_CHILD_POLICY`; policy is
  only changed if the study clears the §4 bar, as a follow-up ADR. —
  EVAL-005, FEEDBACK-004
- Regression gate: a new model bundle cannot ship if it regresses any
  already-enabled label's calibration below its threshold. — EVAL-006

---

## Milestone I — Admin/Reviewer Tooling

**Scope**
- `apps/admin` grows from the Milestone 0 shell into: content review queue
  (ADR-003 approve/release/rollback UI), `ContentIssueReport` triage,
  `TeacherReview` workflow (Principle 4 — the human-review escalation path
  going live).

**Acceptance criteria**
- A content reviewer can approve/release/roll back a `QuranContentVersion`
  entirely through the admin UI, each action producing an `AuditEvent`. —
  CONTENT-005, ADMIN-001
- `teacherReviewAvailable` flips to true only for attempts with a
  provisioned reviewing teacher relationship; a teacher can view and
  respond to a flagged attempt end-to-end. — TEACHER-001
- Admin routes require a distinct reviewer/teacher role, not just any
  authenticated user. — ADMIN-002

---

## Milestone J — Deployment

**Scope**
- Production infra (IaC for API, inference, Postgres, Redis, object
  storage), EAS build pipeline for mobile dev-client and store builds,
  secrets management, observability (structured logs with the audio-URL
  redaction from ADR-004, metrics, alerting on the §4 thresholds).

**Acceptance criteria**
- One-command (or one-pipeline) deploy from a merged `main` to a staging
  environment; smoke test suite runs post-deploy. — INFRA-003
- Alerting fires if evaluation completion rate drops below 99% or P95
  latency exceeds 15s in production, matching §4. — INFRA-004
- Structured logs contain zero raw audio URLs across a sampled 24h window
  (automated log-scan check). — INFRA-005, matches ADR-004
