import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from './jwt.js';

const SECRET = 'test-secret-at-least-16-chars';

describe('signAccessToken / verifyAccessToken', () => {
  it('round-trips claims', () => {
    const token = signAccessToken({ sub: 'user-1', guest: false }, SECRET);
    const claims = verifyAccessToken(token, SECRET);
    expect(claims).toEqual({ sub: 'user-1', guest: false });
  });

  it('marks guest tokens as guest: true', () => {
    const token = signAccessToken({ sub: 'guest-1', guest: true }, SECRET);
    expect(verifyAccessToken(token, SECRET).guest).toBe(true);
  });

  it('rejects a token signed with a different secret', () => {
    const token = signAccessToken({ sub: 'user-1', guest: false }, SECRET);
    expect(() => verifyAccessToken(token, 'a-completely-different-secret')).toThrow();
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken({ sub: 'user-1', guest: false }, SECRET);
    expect(() => verifyAccessToken(`${token}tampered`, SECRET)).toThrow();
  });
});
