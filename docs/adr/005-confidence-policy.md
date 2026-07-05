# ADR-005: Confidence Policy

- Status: Accepted
- Date: 2026-07-03

## Context

Principle 2 requires calibrated confidence tiers and forbids any component
other than the feedback policy layer from turning a model signal into a
user-facing label. §4 sets provisional thresholds (precision ≥ 90% for
high-confidence labels, false "definite mistake" rate < 2%, tier calibration
must be observed on the golden corpus before a tier's labels ship) and
requires child profiles get a stricter policy, with per-label feature flags.

## Decision

### Tier semantics (fixed)

| Tier | Meaning | UI behavior |
|---|---|---|
| `high` | Evidence-backed, above the precision-gated threshold | Specific feedback with evidence (e.g., playback of the flagged word, reference-audio comparison) |
| `medium` | Plausible issue, not evidence-grade | "Possible issue" prompt with replay/retry — never phrased as a confirmed mistake |
| `low` | Below reliable-signal threshold | Abstain entirely — nothing shown for that word; never rendered as a "mistake" label |

This mapping is implemented once, in `packages/domain/src/confidence/
confidenceTier.ts` (`resolveConfidenceTier`), and is the only function
permitted to produce a `ConfidenceTier`. `services/inference` returns raw
`modelConfidence` floats on `IssueCandidate` (see
`packages/api-contracts/openapi.yaml` — internal-only field, explicitly
never returned by `GET /attempts/{id}/feedback`); `services/api` calls
`resolveConfidenceTier` when building the `FeedbackReport`, and that report
— not the raw result — is what any client renders.

### Per-profile-age policy

`ConfidencePolicy` is parameterized (`highThreshold`, `mediumThreshold`),
with two named presets:

- `DEFAULT_ADULT_POLICY`: `high ≥ 0.90`, `medium ≥ 0.70` — matches the §4
  precision target directly (0.90 is not arbitrary; it's the release-gate
  precision floor for high-confidence labels).
- `DEFAULT_CHILD_POLICY`: `highThreshold = +Infinity`, `medium ≥ 0.80` — no
  score reaches `high` for a child profile under this policy, i.e. **no
  "definite mistake" labels are possible for child audio**, structurally,
  until child-audio precision is proven and this constant is revisited
  (§4: "no user-facing 'definite mistake' labels for child profiles until
  child-audio precision is proven"). This is enforced by the threshold
  value itself, not by a downstream conditional that could be forgotten at
  a call site.

Which policy applies is resolved from `Profile.type` (`adult`/`child`) at
the point `services/api` builds the feedback report — never client-side,
so a compromised or outdated mobile build cannot select a laxer policy.

### Feature-flag gating of labels

§4: "A user-facing issue label is feature-flagged OFF until its threshold is
met. Flags for labels are independent from model deployment." Concretely:
a new `IssueCandidate.kind` (omission/repetition/substitution) or a policy
threshold change may deploy to `services/inference`/`services/api` while
remaining invisible to users — the feedback-report builder checks a
per-`(kind, tier, profileAgeClass)` flag before including an item, defaulting
closed. This decouples "the model is good enough to compute this" from "we
have golden-corpus evidence this specific label is calibrated," which is the
whole point of §4's calibration requirement: a model can ship dark while its
precision is being measured against the golden corpus.

### What this ADR does not decide

The actual flag-storage mechanism (config service vs. a `FeatureFlag` table)
is a Milestone A/C implementation detail, not an architectural commitment;
this ADR fixes only that the check exists and defaults closed, and that it
is keyed by `(label kind, tier, profile age class)` at minimum.

## Consequences

- A model change alone can never surface a new label to users — a flag flip
  (backed by golden-corpus evidence) is a separate, auditable action.
- Child-profile "no high tier" is a value in code
  (`DEFAULT_CHILD_POLICY.highThreshold`), covered by
  `confidenceTier.test.ts`, not a policy document that could drift from
  implementation.

## Alternatives considered

- **Single adult/child-agnostic threshold set**: rejected — directly
  violates §4's explicit child-audio carve-out.
- **Let `services/inference` return pre-labeled tiers**: rejected — moves
  the one Principle-2-controlled decision outside `packages/domain`, and
  couples label calibration to a model deployment instead of a
  golden-corpus-gated flag.
