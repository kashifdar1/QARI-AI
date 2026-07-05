# ADR-003: Content Versioning

- Status: Accepted
- Date: 2026-07-03

## Context

Principle 1 requires that Quranic Arabic enter the system only through a
versioned import pipeline, never as hand-written literals. Principle 3 fixes
the launch riwayah to Hafs 'an 'Asim and forbids silently mixing riwayat.
We need a concrete model for how a content release is represented, verified,
cut, and rolled back.

## Decision

### QuranContentVersion is the unit of release

A `QuranContentVersion` row represents one immutable, checksum-verified
import of Uthmani text (+ word-timing data where available) for a single
riwayah. Columns (see schema): `id`, `riwayah` (fixed to `hafs_an_asim` at
launch), `source` (`tanzil_net_uthmani`), `source_checksum`,
`review_status` (`pending_review` → `approved` → optionally
`rolled_back`), `released_at`.

`Passage` and `ReciterAudio` rows reference a `content_version_id`. A
passage's actual Arabic text is never stored as a column value read by
application code paths that also handle arbitrary user input — it lives in
a content blob table populated exclusively by the import job, so the same
text-integrity boundary exists at the data layer, not just in application
code review.

### Import → review → release

1. **Import job** (offline, human-triggered) pulls Tanzil.net Uthmante text,
   verifies the published checksum, and — separately — evaluates QUL
   datasets for word-level timing data where licensed. Writes a new
   `QuranContentVersion` row with `review_status = pending_review`. This job
   is the *only* code path permitted to write Quranic text into the
   database.
2. **Review**: a human (content reviewer role, tracked via `AuditEvent`)
   diffs the new version against the previous approved version and the
   verified source checksum, then flips `review_status` to `approved`. No
   automated process may set `approved`.
3. **Release (cut)**: setting `released_at` makes the version the one new
   `PracticeSession`s are created against. Existing in-flight sessions keep
   their original `content_version_id` — a mid-session content swap is
   never allowed, so an `Attempt`'s evaluation always aligns against the
   exact text the learner was shown.
4. **Rollback**: releasing is append-only — rollback means releasing a
   *new* version pointing back at the prior approved content (or setting
   `review_status = rolled_back` on the bad version and re-releasing the
   last good one). We never delete or mutate a released version in place,
   because `EvaluationResult.content_version_id` and
   `ContentIssueReport` rows point at it permanently for audit purposes.

### Riwayah guard

`packages/content-schema` (`SUPPORTED_RIWAYAT`, `assertSupportedRiwayah`) is
the single source of truth for which riwayat are launch-supported. Passage
and content-version schemas type `riwayah` as a literal union over that set
(currently a union of one: `hafs_an_asim`). Adding a riwayah is a content
and product decision requiring a new ADR — not a config flag — because it
changes what "correct" means for alignment and feedback, and because
Principle 3 requires it be surfaced explicitly in reciter/content metadata
everywhere, not defaulted silently.

### Content issue reporting

`ContentIssueReport` links to the `EvaluationResult` (and transitively the
`content_version_id`) it was raised against, so a reported issue is always
traceable to the exact text version a user saw — required both for content
QA and for distinguishing "the model was wrong" from "the content was
wrong."

## Consequences

- No migration or seed file in this repo may contain literal Quranic Arabic;
  content tables are populated only by the (not-yet-built, Milestone B)
  import job. Milestone 0's migrations create the tables with this
  constraint documented inline but ship no content rows.
- A content release is cheap to reason about: "what does the user see" is
  always `released_at`'s version at session-creation time, frozen for the
  life of that session/attempt/result chain.

## Alternatives considered

- **Mutate text in place with a version counter column**: rejected — breaks
  the audit trail (`ContentIssueReport` → `EvaluationResult` →
  `content_version_id` would point at data that no longer matches what was
  actually recited against).
- **Store riwayah as a free-text column**: rejected — Principle 3 requires
  hard guarding against silent mixing; a literal-typed enum sourced from one
  module is the mechanism, not a convention.
