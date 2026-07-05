# ADR-001: Architecture Baseline

- Status: Accepted
- Date: 2026-07-03

## Context

Milestone 0 needs a fixed system shape before any feature code is written:
service boundaries, the monorepo layout, and — critically — the shape of the
ML baseline, since that choice determines what the API contract, database
schema, and confidence-tier policy all need to carry.

## Decision

### Monorepo

pnpm workspaces + Turborepo, one repo, layout fixed by CLAUDE.md §3:

```
apps/mobile            React Native (Expo, dev client)
apps/admin              Reviewer/admin web portal (shell only, post-MVP features)
services/api             Node.js/TypeScript/Fastify REST API
services/inference        Python/FastAPI ML inference service
packages/domain           Framework-free business logic (recorder FSM, confidence policy, scoring)
packages/ui                Shared design tokens / components
packages/api-contracts    OpenAPI spec, generated types/clients
packages/content-schema   Quran content metadata schemas (never the Arabic text itself)
packages/config            Shared env/config schemas
infrastructure              docker-compose, IaC
docs                          ADRs, backlog, architecture docs
test-data/golden-audio      Consented golden-corpus clips (Milestone C+)
```

Rationale: `packages/domain` is intentionally framework-free (no Fastify, no
React Native, no Expo imports) so the recorder state machine, confidence
policy, and scoring logic are the same code — not a reimplementation — on
both the mobile client (optimistic local state) and the API (server-side
validation of state transitions). This is the mechanism that keeps
Non-Negotiable Principle 2 (no manufactured certainty) enforceable: the
feedback policy layer lives in `packages/domain` and is the only place a
model score becomes a user-facing tier/label, and both API and mobile import
the same function rather than each encoding their own copy of the tier
thresholds.

### Service boundaries

- **services/api** owns auth, sessions, attempts, content metadata,
  consent, and orchestration. It never runs inference itself.
- **services/inference** owns forced alignment only. It is stateless per
  request: given known target text + audio, return word timings and issue
  candidates. It does not decide labels or tiers — that's `packages/domain`,
  invoked from `services/api` after the inference call returns.
- **BullMQ/Redis** decouples attempt-complete (API) from alignment
  (inference), so a slow or restarting inference service does not block
  upload confirmation.

### Why forced alignment against known text, not open transcription

The task is recitation *evaluation*, not *transcription*. The learner is
reciting a specific, already-known passage. Open transcription (free ASR
decoding, then diffing the decoded text against the target) is:

1. **Strictly harder than necessary.** Free decoding has to solve word
   recognition *and* segmentation with no prior on what should be said;
   forced alignment only has to solve alignment, because the target
   sequence is given. This directly improves the accuracy ceiling for a
   fixed model, which matters against the §4 thresholds (≥95% word-alignment
   accuracy, ≥90% high-confidence precision).
2. **Structurally safer for Principle 1 (sacred text integrity).** Open
   transcription risks the model "hallucinating" or auto-correcting toward
   plausible-but-wrong Quranic text in its output, which could put
   unreviewed model-generated Arabic in front of a user. Forced alignment
   never generates text — the known target string, sourced only from the
   versioned content pipeline, is a *fixed input* to alignment, not an
   output.
3. **Produces exactly the artifact the feedback policy needs.** Word-level
   timings + a small set of deviation candidates (omission/repetition/
   substitution) map directly onto `WordSegment`/`IssueCandidate` and the
   confidence-tier policy (ADR-005). Open transcription would still need a
   diff-and-classify step on top, adding another lossy stage between raw
   model output and the label a child sees.

Concretely: pretrained Arabic ASR (wav2vec2/Whisper-family, Quran-fine-tuned
checkpoint where available) produces frame-level or phoneme-level
posteriors; CTC forced alignment against the known word sequence produces
word timings; timing/confidence deviations are turned into
omission/repetition/substitution *candidates* — deliberately not yet
"mistakes." Candidate → label is the feedback policy's job, gated by
confidence tier and profile age (child vs. adult), never the inference
service's.

## Consequences

- `services/inference` has a narrow, testable contract (audio + target text
  in; word timings + candidates out) and can be evaluated against the golden
  corpus independent of the API.
- `packages/domain` must stay dependency-free of both Fastify and React
  Native; a lint rule enforcing this is expected in Milestone A.
- Because inference never emits free text, there is no code path where model
  output could be mistaken for or substituted into Quranic text.

## Alternatives considered

- **Open transcription + diff**: rejected per above (weaker accuracy
  ceiling, more places to violate Principle 1).
- **Single deployable (API + inference in one Node process via
  ONNX/transformers.js)**: rejected — Python has the mature
  wav2vec2/Whisper/forced-alignment ecosystem; splitting also lets the two
  services scale and deploy independently (inference is GPU-bound, API is
  not).
