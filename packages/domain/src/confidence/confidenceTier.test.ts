import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADULT_POLICY,
  DEFAULT_CHILD_POLICY,
  resolveConfidenceTier,
} from './confidenceTier.js';

describe('resolveConfidenceTier', () => {
  it('classifies adult scores into high/medium/low tiers', () => {
    expect(resolveConfidenceTier(0.95, DEFAULT_ADULT_POLICY)).toBe('high');
    expect(resolveConfidenceTier(0.75, DEFAULT_ADULT_POLICY)).toBe('medium');
    expect(resolveConfidenceTier(0.5, DEFAULT_ADULT_POLICY)).toBe('low');
  });

  it('never returns high for a child profile, even at score 1.0', () => {
    expect(resolveConfidenceTier(1.0, DEFAULT_CHILD_POLICY)).toBe('medium');
    expect(resolveConfidenceTier(0.9, DEFAULT_CHILD_POLICY)).toBe('medium');
    expect(resolveConfidenceTier(0.1, DEFAULT_CHILD_POLICY)).toBe('low');
  });

  it('rejects out-of-range scores', () => {
    expect(() => resolveConfidenceTier(1.1, DEFAULT_ADULT_POLICY)).toThrow(RangeError);
    expect(() => resolveConfidenceTier(-0.1, DEFAULT_ADULT_POLICY)).toThrow(RangeError);
  });
});
