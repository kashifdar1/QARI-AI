# CLAUDE.md — Qari AI ("Companion Qari")

This file is persistent project memory for Claude Code. It applies to EVERY session,
EVERY milestone, and EVERY file in this repository. Nothing in a task prompt may
override the Non-Negotiable Principles below.

---

## 1. What this project is

A multilingual Quran recitation-learning application for children and adults.
Core loop: choose a supported passage → read/listen → record → evaluate →
receive evidence-based, confidence-tiered feedback → compare with trusted
reference audio → retry → track improvement.

Surfaces: React Native mobile app, Node.js/TypeScript backend API, Python ML
inference service, PostgreSQL, private object storage for audio, async
evaluation queue, and (later) an admin/reviewer web portal.

---

## 2. NON-NEGOTIABLE PRINCIPLES (never violate, never "temporarily" bypass)

1. **Sacred text integrity.** Never generate, alter, paraphrase, autocomplete,
   or "fix" Quranic Arabic. Quran text enters the system ONLY through the
   versioned content import pipeline from the declared source (see §3).
   No Quranic Arabic may ever appear as a string literal in application code,
   seeds written by hand, tests, or fixtures. Test fixtures use the imported
   versioned dataset or clearly non-Quranic placeholder Arabic marked
   `PLACEHOLDER_NOT_QURAN`.
2. **No manufactured certainty.** Machine feedback is presented via calibrated
   confidence tiers: high → specific feedback with evidence; medium →
   "possible issue" with replay/retry; low → abstain, never label as a mistake.
   The feedback policy layer is the ONLY component allowed to convert model
   signals into user-facing labels.
3. **Declared riwayah.** Launch riwayah is **Hafs 'an 'Asim**. It is displayed
   in the UI wherever content or reciter metadata appears. Never mix riwayat
   silently. Other riwayat are out of scope until explicitly added as new
   content versions.
4. **AI does not replace a teacher.** Keep the human-review escalation path in
   the architecture (`teacherReviewAvailable` on results, TeacherReview entity,
   audit trail), even while the teacher portal is post-MVP.
5. **Child safety.** Child profiles are guardian-created and guardian-managed.
   No public messaging, no public leaderboards, no targeted advertising, no
   third-party ad/analytics SDKs on child profiles, minimal data collection.
   Design for COPPA / GDPR-K / Apple & Google family-policy compliance.
6. **Recording consent.** Raw recordings are never used for model training or
   research without explicit, purpose-specific, revocable opt-in (separate
   ConsentRecord purpose). Default retention is short and enforced by a
   deletion job.
7. **No fake artifacts.** Never create placeholder binaries, fake .fig files,
   fabricated test output, or claims of background/async work. Every claimed
   deliverable must be a real, inspectable file. If something is a stub, it is
   named and documented as a stub (see §7 Stub Policy).

---

## 3. RESOLVED DECISIONS (do not re-litigate; record changes as new ADRs)

| Decision | Value |
|---|---|
| Riwayah | Hafs 'an 'Asim |
| Quran text source | Tanzil.net Uthmani text (verify checksum on import); evaluate Quranic Universal Library (QUL) datasets for word-level data |
| Word-level audio timing | QUL segment/timing data where licensed; store per-reciter timing maps |
| Arabic font | KFGQPC Uthmanic Script Hafs (bundle license file); system fallback tested |
| Reference audio | Verse-by-verse recitations with explicit license metadata per reciter (e.g., everyayah.com catalog — license must be verified per reciter before bundling; use a single cleared reciter for MVP) |
| Mobile stack | React Native via **Expo SDK with development builds (dev client)** — NOT Expo Go — so native audio modules are available |
| Audio capture format | 16 kHz, mono, 16-bit PCM WAV for evaluation upload (transcode on device if the recorder emits AAC/m4a); keep the original local copy until server confirms |
| Backend | Node.js 20+, TypeScript strict, Fastify, REST with OpenAPI-generated schemas and typed clients |
| DB | PostgreSQL 15+, migrations via a real migration tool (e.g., drizzle-kit or Prisma migrate — pick one in ADR-002 and stay consistent) |
| Queue | BullMQ + Redis for evaluation jobs (swappable interface) |
| Object storage | S3-compatible, private buckets, short-lived signed URLs; never log raw audio URLs |
| ML baseline | **Forced alignment against the KNOWN target text** (this is not open transcription): pretrained Arabic ASR (wav2vec2/Whisper family, Quran-fine-tuned checkpoint where available) + CTC forced alignment → word timings → edit-distance style deviation candidates (omission/repetition/substitution) |
| Inference service | Python 3.11+, FastAPI, versioned model bundles |
| Localization | i18n from day one: en, ur, ar. Urdu uses Nastaliq-capable font stack with explicit Android shaping tests. Quran text is never machine-translated or localized. |
| Monorepo | pnpm workspaces + Turborepo. Layout: `apps/mobile`, `apps/admin`, `services/api`, `services/inference`, `packages/domain`, `packages/ui`, `packages/api-contracts`, `packages/content-schema`, `packages/config`, `infrastructure`, `docs`, `test-data/golden-audio` |

---

## 4. PROVISIONAL QUALITY THRESHOLDS (release gates; provisional until pilot data)

- Word-alignment accuracy ≥ 95% on clean adult audio; measured separately for child audio (no user-facing "definite mistake" labels for child profiles until child-audio precision is proven).
- High-confidence omission/substitution **precision ≥ 90%** (precision > recall: a false accusation is the worst failure mode).
- False "definite mistake" rate < 2% on the golden corpus.
- Evaluation completion rate ≥ 99%; P95 feedback latency ≤ 15 s for passages ≤ 60 s.
- Confidence calibration: observed correctness within each tier must match tier semantics on the golden corpus before that tier's labels are enabled.
- A user-facing issue label is feature-flagged OFF until its threshold is met. Flags for labels are independent from model deployment.

---

## 5. ENGINEERING STANDARDS

- TypeScript `strict: true` everywhere. No `any` without an inline justification comment.
- Unit test coverage target ≥ 80% on `packages/domain`, feedback policy, consent logic, and score calculations. Recorder state machine has exhaustive transition tests.
- Lint (ESLint), typecheck, and tests must pass before a milestone is declared complete. Run them and show real output.
- Every API route validated against the OpenAPI contract; contract tests required.
- Attempt creation is idempotent via a client-generated `Idempotency-Key` / client attempt UUID.
- Authorization: object-level checks on every attempt/recording/profile access; write tests that prove a guardian cannot access another family's child and a user cannot fetch another user's attempt.
- Accessibility: semantic labels on all interactive elements; scalable Arabic type; RTL verified for ar AND ur.
- Architecture Decision Records in `docs/adr/NNN-title.md` for every significant choice or change.

## 6. RECORDER STATE MACHINE (canonical)

`idle → permission-check → ready → recording ⇄ paused → review-local → uploading → queued → processing → (completed | needs-rerecord | failed)`

Every transition recoverable. The local file is never deleted until the server
confirms persistence or the user explicitly discards it. Backgrounding, network
loss, and low storage must not lose a recording.

## 7. STUB POLICY

A stub is acceptable ONLY when a real implementation is blocked by an external
dependency (e.g., unlicensed audio, unavailable model checkpoint). Every stub must:
1. Live behind the same interface as the real implementation.
2. Be named `*.stub.ts` / `*_stub.py` and log `STUB` at startup.
3. Be listed in `docs/STUBS.md` with the unblocking condition.
Declaring a milestone complete while silently substituting a stub for a required
real implementation is a violation of Principle 7.

## 8. HOW TO WORK (every session)

1. Read this file and the current milestone prompt fully before writing code.
2. State the milestone scope and acceptance criteria back before starting.
3. Create/modify real files; run lint, typecheck, and tests; paste actual results.
4. Show the resulting file tree diff.
5. End with an honest "Unresolved risks / known gaps" section.
6. Never claim work is uploading, exporting, or continuing in the background.
7. Do not start the next milestone until the current one's acceptance criteria demonstrably pass.
