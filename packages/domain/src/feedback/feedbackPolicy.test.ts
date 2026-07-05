import { describe, expect, it } from 'vitest';
import {
  ALL_LABELS_DISABLED,
  buildFeedback,
  type BuildFeedbackInput,
  type LabelFeatureFlags,
} from './feedbackPolicy.js';

const ENABLE_ALL: LabelFeatureFlags = { isEnabled: () => true };

function baseInput(overrides: Partial<BuildFeedbackInput> = {}): BuildFeedbackInput {
  return {
    evaluationStatus: 'completed',
    passageVersion: 'content-version-1',
    modelBundleVersion: 'model-1',
    audioQuality: { passed: true, durationSeconds: 5, failureReasons: [] },
    wordSegments: [
      { wordIndex: 0, startMs: 0, endMs: 400 },
      { wordIndex: 1, startMs: 400, endMs: 900 },
    ],
    rawIssueCandidates: [],
    profileAgeClass: 'adult',
    referenceAudioBaseUrl: 'https://example.com/audio.wav',
    ...overrides,
  };
}

describe('buildFeedback — needs_rerecord / failed', () => {
  it('needs_rerecord always requires a retry and never has issues or teacher review', () => {
    const result = buildFeedback(
      baseInput({
        evaluationStatus: 'needs_rerecord',
        audioQuality: { passed: false, durationSeconds: 0.1, failureReasons: ['too_short'] },
        rawIssueCandidates: [{ wordIndex: 0, kind: 'omission', modelConfidence: 0.99 }],
      }),
    );
    expect(result.evaluationStatus).toBe('needs_rerecord');
    expect(result.issueCandidates).toEqual([]);
    expect(result.wordSegments).toEqual([]);
    expect(result.retryRecommendation).toBe('required');
    expect(result.teacherReviewAvailable).toBe(false);
    expect(result.coachingMessages[0]).toContain('too short');
  });

  it('failed status also requires a retry with a generic coaching message', () => {
    const result = buildFeedback(baseInput({ evaluationStatus: 'failed' }));
    expect(result.retryRecommendation).toBe('required');
    expect(result.coachingMessages[0]).toMatch(/went wrong/i);
  });
});

describe('buildFeedback — clean attempt', () => {
  it('no issue candidates yields high confidence, no retry needed, an encouraging message', () => {
    const result = buildFeedback(baseInput());
    expect(result.confidenceTier).toBe('high');
    expect(result.issueCandidates).toEqual([]);
    expect(result.retryRecommendation).toBe('not_needed');
    expect(result.referenceAudioSlices).toEqual([]);
    expect(result.coachingMessages[0]).toMatch(/great job/i);
  });
});

describe('buildFeedback — the abstain state (low confidence)', () => {
  it('a low-confidence candidate is NEVER labeled, even if its flag were somehow on, and renders the abstain message', () => {
    const result = buildFeedback(
      baseInput({
        rawIssueCandidates: [{ wordIndex: 0, kind: 'omission', modelConfidence: 0.5 }],
        labelFeatureFlags: ENABLE_ALL,
      }),
    );
    expect(result.issueCandidates).toHaveLength(1);
    expect(result.issueCandidates[0]?.tier).toBe('low');
    expect(result.issueCandidates[0]?.label).toBeNull();
    expect(result.confidenceTier).toBe('low');
    expect(result.referenceAudioSlices).toEqual([]);
    expect(result.retryRecommendation).toBe('not_needed');
    expect(result.coachingMessages[0]).toMatch(/weren't confident|not marked as a mistake/i);
  });
});

describe('buildFeedback — feature-flag gating (CLAUDE.md §4)', () => {
  it('a high-confidence candidate produces no visible label when its flag is off (default)', () => {
    const result = buildFeedback(
      baseInput({
        rawIssueCandidates: [{ wordIndex: 0, kind: 'substitution', modelConfidence: 0.95 }],
        labelFeatureFlags: ALL_LABELS_DISABLED,
      }),
    );
    expect(result.issueCandidates[0]?.tier).toBe('high');
    expect(result.issueCandidates[0]?.label).toBeNull();
    expect(result.confidenceTier).toBe('low'); // flagged-off is indistinguishable from clean, by design
    expect(result.referenceAudioSlices).toEqual([]);
  });

  it('a high-confidence candidate IS labeled and surfaced when its flag is on', () => {
    const result = buildFeedback(
      baseInput({
        rawIssueCandidates: [{ wordIndex: 0, kind: 'substitution', modelConfidence: 0.95 }],
        labelFeatureFlags: ENABLE_ALL,
      }),
    );
    expect(result.issueCandidates[0]?.label).toBe('substitution');
    expect(result.confidenceTier).toBe('high');
    expect(result.retryRecommendation).toBe('recommended');
    expect(result.referenceAudioSlices).toEqual([
      { wordIndexStart: 0, wordIndexEnd: 0, audioUrl: 'https://example.com/audio.wav#t=0,0.4' },
    ]);
    expect(result.coachingMessages[0]).toContain('substitution');
  });

  it('a medium-confidence candidate is labeled when its flag is on, with medium overall tier', () => {
    const result = buildFeedback(
      baseInput({
        rawIssueCandidates: [{ wordIndex: 1, kind: 'repetition', modelConfidence: 0.75 }],
        labelFeatureFlags: ENABLE_ALL,
      }),
    );
    expect(result.issueCandidates[0]?.tier).toBe('medium');
    expect(result.issueCandidates[0]?.label).toBe('repetition');
    expect(result.confidenceTier).toBe('medium');
    expect(result.retryRecommendation).toBe('recommended');
  });

  it('the overall tier reflects the highest visible severity across multiple issues', () => {
    const result = buildFeedback(
      baseInput({
        rawIssueCandidates: [
          { wordIndex: 0, kind: 'repetition', modelConfidence: 0.75 }, // medium
          { wordIndex: 1, kind: 'omission', modelConfidence: 0.95 }, // high
        ],
        labelFeatureFlags: ENABLE_ALL,
      }),
    );
    expect(result.confidenceTier).toBe('high');
    expect(result.issueCandidates).toHaveLength(2);
  });
});

describe('buildFeedback — child profile stricter abstention (ADR-005)', () => {
  it('a confidence score that reaches "high" for an adult never reaches "high" for a child', () => {
    const adult = buildFeedback(
      baseInput({
        rawIssueCandidates: [{ wordIndex: 0, kind: 'omission', modelConfidence: 0.95 }],
        profileAgeClass: 'adult',
        labelFeatureFlags: ENABLE_ALL,
      }),
    );
    const child = buildFeedback(
      baseInput({
        rawIssueCandidates: [{ wordIndex: 0, kind: 'omission', modelConfidence: 0.95 }],
        profileAgeClass: 'child',
        labelFeatureFlags: ENABLE_ALL,
      }),
    );
    expect(adult.issueCandidates[0]?.tier).toBe('high');
    expect(child.issueCandidates[0]?.tier).not.toBe('high');
  });
});

describe('buildFeedback — teacherReviewAvailable', () => {
  it('is always false at this milestone (Principle 4: escalation path exists in the shape, portal is post-MVP)', () => {
    expect(buildFeedback(baseInput()).teacherReviewAvailable).toBe(false);
    expect(
      buildFeedback(baseInput({ rawIssueCandidates: [{ wordIndex: 0, kind: 'omission', modelConfidence: 0.99 }], labelFeatureFlags: ENABLE_ALL }))
        .teacherReviewAvailable,
    ).toBe(false);
  });
});
