/**
 * Confidence-tier semantics (CLAUDE.md Principle 2 / ADR-005). This is the
 * ONLY place model scores are allowed to become a user-facing label
 * decision; nothing upstream (inference service, API) may hand out labels
 * directly.
 */

export type ConfidenceTier = 'high' | 'medium' | 'low';

export type ConfidencePolicy = {
  /** Score at/above this is 'high' */
  highThreshold: number;
  /** Score at/above this (and below highThreshold) is 'medium' */
  mediumThreshold: number;
};

export const DEFAULT_ADULT_POLICY: ConfidencePolicy = {
  highThreshold: 0.9,
  mediumThreshold: 0.7,
};

/**
 * Child profiles get a stricter abstention policy per CLAUDE.md Principle 5
 * and ADR-005: no user-facing "definite mistake" labels for child audio
 * until child-audio precision is proven (§4). Until that flag flips, the
 * child policy simply never reaches 'high'.
 */
export const DEFAULT_CHILD_POLICY: ConfidencePolicy = {
  highThreshold: Number.POSITIVE_INFINITY,
  mediumThreshold: 0.8,
};

export function resolveConfidenceTier(score: number, policy: ConfidencePolicy): ConfidenceTier {
  if (score < 0 || score > 1) {
    throw new RangeError(`score must be in [0, 1], got ${score}`);
  }
  if (score >= policy.highThreshold) return 'high';
  if (score >= policy.mediumThreshold) return 'medium';
  return 'low';
}
