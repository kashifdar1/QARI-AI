import { describe, expect, it } from 'vitest';
import { ForbiddenError, requireProfileAccess } from './authorization.js';

describe('requireProfileAccess', () => {
  it('does not throw for the owning user', () => {
    expect(() => requireProfileAccess('user-a', { ownerUserId: 'user-a' })).not.toThrow();
  });

  it('throws ForbiddenError for a different user (cross-family isolation)', () => {
    expect(() => requireProfileAccess('user-b', { ownerUserId: 'user-a' })).toThrow(
      ForbiddenError,
    );
  });
});
