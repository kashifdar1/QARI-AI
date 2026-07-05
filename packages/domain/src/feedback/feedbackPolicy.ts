import {
  DEFAULT_ADULT_POLICY,
  DEFAULT_CHILD_POLICY,
  resolveConfidenceTier,
  type ConfidenceTier,
} from '../confidence/confidenceTier.js';

/**
 * The feedback policy layer (Milestone C task 3, CLAUDE.md Principle 2):
 * the ONLY place raw model output (issue candidates + their alignment-
 * derived confidence scores from services/inference) is converted into a
 * structured, user-facing feedback object. Everything upstream of this
 * (services/inference, services/api's evaluation-job consumer) must pass
 * its output through `buildFeedback` — nothing else may decide what a
 * user sees.
 */

export type AudioQualitySummary = {
  passed: boolean;
  durationSeconds: number;
  failureReasons: string[];
};

export type WordSegment = {
  wordIndex: number;
  startMs: number;
  endMs: number;
};

export type IssueKind = 'omission' | 'repetition' | 'substitution';

export type RawIssueCandidate = {
  wordIndex: number;
  kind: IssueKind;
  /** Raw, uncalibrated alignment-derived score in [0, 1] — see
   * services/inference/app/deviation.py's `_log_prob_to_confidence`. */
  modelConfidence: number;
};

export type FeedbackIssueItem = {
  wordIndex: number;
  tier: ConfidenceTier;
  /** Present only when the tier/kind combination is above the low floor
   * AND its feature flag is on; otherwise null (abstain — never a label). */
  label: IssueKind | null;
};

export type ReferenceAudioSlice = {
  wordIndexStart: number;
  wordIndexEnd: number;
  audioUrl: string;
};

export type EvaluationStatus = 'completed' | 'needs_rerecord' | 'failed';
export type RetryRecommendation = 'not_needed' | 'recommended' | 'required';

export type FeedbackResult = {
  evaluationStatus: EvaluationStatus;
  passageVersion: string;
  modelBundleVersion: string;
  audioQuality: AudioQualitySummary;
  wordSegments: WordSegment[];
  issueCandidates: FeedbackIssueItem[];
  /** Summary tier for the whole attempt: 'high' = a high-confidence issue
   * was found and is shown; 'medium' = only medium-confidence issues;
   * 'low' = either nothing was flagged (clean) or the only signal
   * available is below the reliable-signal floor (abstain — never
   * labeled a mistake). See `resolveOverallTier` for the exact rule. */
  confidenceTier: ConfidenceTier;
  coachingMessages: string[];
  referenceAudioSlices: ReferenceAudioSlice[];
  retryRecommendation: RetryRecommendation;
  /** Principle 4: the human-review escalation path always exists in the
   * data shape, even while the teacher portal itself is post-MVP (always
   * false until Milestone I ships it). */
  teacherReviewAvailable: boolean;
};

export type ProfileAgeClass = 'adult' | 'child';

export type LabelFeatureFlags = {
  /** Keyed `${kind}:${tier}` — CLAUDE.md §4: "A user-facing issue label is
   * feature-flagged OFF until its threshold is met." Defaults closed for
   * any key not present. */
  isEnabled(kind: IssueKind, tier: ConfidenceTier): boolean;
};

/** All labels off — the safe default until golden-corpus calibration (Milestone H) proves a label's threshold. */
export const ALL_LABELS_DISABLED: LabelFeatureFlags = {
  isEnabled: () => false,
};

export type BuildFeedbackInput = {
  evaluationStatus: EvaluationStatus;
  passageVersion: string;
  modelBundleVersion: string;
  audioQuality: AudioQualitySummary;
  wordSegments: WordSegment[];
  rawIssueCandidates: RawIssueCandidate[];
  profileAgeClass: ProfileAgeClass;
  referenceAudioBaseUrl: string;
  labelFeatureFlags?: LabelFeatureFlags;
};

function policyFor(profileAgeClass: ProfileAgeClass) {
  return profileAgeClass === 'child' ? DEFAULT_CHILD_POLICY : DEFAULT_ADULT_POLICY;
}

function resolveOverallTier(items: FeedbackIssueItem[]): ConfidenceTier {
  // No candidates at all means alignment found nothing to question — a
  // genuinely clean, high-confidence result, distinct from "we found
  // something but can't confidently label it" (which the empty-visible
  // branches below correctly leave at 'low').
  if (items.length === 0) return 'high';
  if (items.some((i) => i.tier === 'high' && i.label !== null)) return 'high';
  if (items.some((i) => i.tier === 'medium' && i.label !== null)) return 'medium';
  return 'low';
}

function buildCoachingMessages(
  status: EvaluationStatus,
  audioQuality: AudioQualitySummary,
  items: FeedbackIssueItem[],
): string[] {
  if (status === 'needs_rerecord') {
    if (audioQuality.failureReasons.length > 0) {
      return audioQuality.failureReasons.map((reason) => `Please try again: ${reason.replace(/_/g, ' ')}.`);
    }
    return ['Please try recording again.'];
  }
  if (status === 'failed') {
    return ['Something went wrong evaluating this attempt. Please try again.'];
  }

  const visible = items.filter((i) => i.label !== null);
  if (visible.length === 0) {
    return items.length === 0
      ? ['Great job! No issues found.']
      : ["We weren't confident enough to flag anything specific — nothing here is marked as a mistake."];
  }
  return visible.map((item) => `Possible ${item.label} near word ${item.wordIndex + 1} — tap to compare.`);
}

function buildReferenceAudioSlices(
  items: FeedbackIssueItem[],
  wordSegments: WordSegment[],
  referenceAudioBaseUrl: string,
): ReferenceAudioSlice[] {
  const segmentByIndex = new Map(wordSegments.map((s) => [s.wordIndex, s]));
  return items
    .filter((item) => item.label !== null)
    .filter((item) => segmentByIndex.has(item.wordIndex))
    .map((item) => ({
      wordIndexStart: item.wordIndex,
      wordIndexEnd: item.wordIndex,
      audioUrl: `${referenceAudioBaseUrl}#t=${segmentByIndex.get(item.wordIndex)!.startMs / 1000},${
        segmentByIndex.get(item.wordIndex)!.endMs / 1000
      }`,
    }));
}

function resolveRetryRecommendation(
  status: EvaluationStatus,
  overallTier: ConfidenceTier,
  hasVisibleIssues: boolean,
): RetryRecommendation {
  if (status !== 'completed') return 'required';
  if (overallTier === 'high' && hasVisibleIssues) return 'recommended';
  if (overallTier === 'medium' && hasVisibleIssues) return 'recommended';
  return 'not_needed';
}

export function buildFeedback(input: BuildFeedbackInput): FeedbackResult {
  const flags = input.labelFeatureFlags ?? ALL_LABELS_DISABLED;
  const policy = policyFor(input.profileAgeClass);

  if (input.evaluationStatus !== 'completed') {
    return {
      evaluationStatus: input.evaluationStatus,
      passageVersion: input.passageVersion,
      modelBundleVersion: input.modelBundleVersion,
      audioQuality: input.audioQuality,
      wordSegments: [],
      issueCandidates: [],
      confidenceTier: 'low',
      coachingMessages: buildCoachingMessages(input.evaluationStatus, input.audioQuality, []),
      referenceAudioSlices: [],
      retryRecommendation: 'required',
      teacherReviewAvailable: false,
    };
  }

  const issueItems: FeedbackIssueItem[] = input.rawIssueCandidates.map((raw) => {
    const tier = resolveConfidenceTier(raw.modelConfidence, policy);
    const label = tier !== 'low' && flags.isEnabled(raw.kind, tier) ? raw.kind : null;
    return { wordIndex: raw.wordIndex, tier, label };
  });

  const overallTier = resolveOverallTier(issueItems);
  const hasVisibleIssues = issueItems.some((i) => i.label !== null);

  return {
    evaluationStatus: 'completed',
    passageVersion: input.passageVersion,
    modelBundleVersion: input.modelBundleVersion,
    audioQuality: input.audioQuality,
    wordSegments: input.wordSegments,
    issueCandidates: issueItems,
    confidenceTier: overallTier,
    coachingMessages: buildCoachingMessages('completed', input.audioQuality, issueItems),
    referenceAudioSlices: buildReferenceAudioSlices(issueItems, input.wordSegments, input.referenceAudioBaseUrl),
    retryRecommendation: resolveRetryRecommendation('completed', overallTier, hasVisibleIssues),
    teacherReviewAvailable: false,
  };
}
