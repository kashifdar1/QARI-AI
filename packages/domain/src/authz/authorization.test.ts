import { describe, expect, it } from 'vitest';
import { canAccessProfile, canAccessProfileOwnedResource } from './authorization.js';

describe('canAccessProfile', () => {
  it('allows the owning user', () => {
    expect(canAccessProfile('user-a', { ownerUserId: 'user-a' })).toBe(true);
  });

  it('denies a different user (cross-family isolation)', () => {
    expect(canAccessProfile('user-b', { ownerUserId: 'user-a' })).toBe(false);
  });

  it('allows a co-guardian listed on the profile', () => {
    expect(
      canAccessProfile('user-b', { ownerUserId: 'user-a', guardianUserIds: ['user-b'] }),
    ).toBe(true);
  });

  it('denies a user not listed as owner or guardian', () => {
    expect(
      canAccessProfile('user-c', { ownerUserId: 'user-a', guardianUserIds: ['user-b'] }),
    ).toBe(false);
  });
});

describe('canAccessProfileOwnedResource', () => {
  it('a guardian cannot access another family\'s child profile', () => {
    const familyAProfile = { ownerUserId: 'guardian-a' };
    const familyBGuardian = 'guardian-b';
    expect(canAccessProfileOwnedResource(familyBGuardian, familyAProfile)).toBe(false);
  });

  it('a user cannot access another user\'s attempt via its owning profile', () => {
    const attemptOwnerProfile = { ownerUserId: 'user-a' };
    expect(canAccessProfileOwnedResource('user-b', attemptOwnerProfile)).toBe(false);
    expect(canAccessProfileOwnedResource('user-a', attemptOwnerProfile)).toBe(true);
  });
});
