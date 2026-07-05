import { beforeEach, describe, expect, it } from 'vitest';
import { verifyAccessToken } from './jwt.js';
import { AuthError, AuthService } from './authService.js';
import { InMemoryUserRepository } from './userRepository.js';

const SECRET = 'test-secret-at-least-16-chars';

function makeService() {
  const repo = new InMemoryUserRepository();
  const service = new AuthService(repo, SECRET);
  return { repo, service };
}

describe('AuthService.signup', () => {
  it('creates a non-guest account and returns a working session', async () => {
    const { service } = makeService();
    const session = await service.signup('a@example.com', 'hunter2hunter2', 'en');
    expect(session.userId).toBeTruthy();
    expect(verifyAccessToken(session.accessToken, SECRET)).toEqual({
      sub: session.userId,
      guest: false,
    });
  });

  it('rejects a duplicate email', async () => {
    const { service } = makeService();
    await service.signup('a@example.com', 'hunter2hunter2', 'en');
    await expect(service.signup('a@example.com', 'different-pass', 'en')).rejects.toThrow(
      AuthError,
    );
  });
});

describe('AuthService.login', () => {
  it('logs in with the correct password', async () => {
    const { service } = makeService();
    await service.signup('a@example.com', 'hunter2hunter2', 'en');
    const session = await service.login('a@example.com', 'hunter2hunter2');
    expect(session.userId).toBeTruthy();
  });

  it('rejects a wrong password', async () => {
    const { service } = makeService();
    await service.signup('a@example.com', 'hunter2hunter2', 'en');
    await expect(service.login('a@example.com', 'wrong-password')).rejects.toThrow(AuthError);
  });

  it('rejects login for an email that does not exist, with the same error as a wrong password (no user-enumeration leak)', async () => {
    const { service } = makeService();
    await service.signup('a@example.com', 'hunter2hunter2', 'en');
    let noSuchUserError: unknown;
    let wrongPasswordError: unknown;
    try {
      await service.login('nobody@example.com', 'irrelevant');
    } catch (err) {
      noSuchUserError = err;
    }
    try {
      await service.login('a@example.com', 'wrong-password');
    } catch (err) {
      wrongPasswordError = err;
    }
    expect((noSuchUserError as AuthError).code).toBe((wrongPasswordError as AuthError).code);
    expect((noSuchUserError as AuthError).message).toBe((wrongPasswordError as AuthError).message);
  });

  it('rejects logging into a guest account with a password (guests have no usable password), even knowing its generated email', async () => {
    const { repo, service } = makeService();
    const guestSession = await service.createGuestSession();
    const guestUser = await repo.findById(guestSession.userId);
    await expect(service.login(guestUser!.email, 'anything')).rejects.toThrow(AuthError);
  });
});

describe('AuthService.createGuestSession', () => {
  it('creates a real user row flagged guest, with a working session', async () => {
    const { repo, service } = makeService();
    const session = await service.createGuestSession();
    const user = await repo.findById(session.userId);
    expect(user?.isGuest).toBe(true);
    expect(verifyAccessToken(session.accessToken, SECRET).guest).toBe(true);
  });
});

describe('AuthService.upgradeGuest', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it('upgrades the caller\'s own guest account and clears isGuest', async () => {
    const { repo, service } = ctx;
    const guestSession = await service.createGuestSession();
    const upgraded = await service.upgradeGuest(
      guestSession.userId,
      'real@example.com',
      'hunter2hunter2',
    );
    expect(upgraded.userId).toBe(guestSession.userId);
    const user = await repo.findById(guestSession.userId);
    expect(user?.isGuest).toBe(false);
    expect(user?.email).toBe('real@example.com');
  });

  it('rejects upgrading an account that is not a guest', async () => {
    const { service } = ctx;
    const session = await service.signup('already@example.com', 'hunter2hunter2', 'en');
    await expect(
      service.upgradeGuest(session.userId, 'new@example.com', 'hunter2hunter2'),
    ).rejects.toThrow(AuthError);
  });

  it('rejects upgrading to an email already in use', async () => {
    const { service } = ctx;
    await service.signup('taken@example.com', 'hunter2hunter2', 'en');
    const guestSession = await service.createGuestSession();
    await expect(
      service.upgradeGuest(guestSession.userId, 'taken@example.com', 'hunter2hunter2'),
    ).rejects.toThrow(AuthError);
  });

  it('rejects upgrading an unknown actor id (cannot forge someone else\'s upgrade)', async () => {
    const { service } = ctx;
    await expect(
      service.upgradeGuest('nonexistent-user-id', 'new@example.com', 'hunter2hunter2'),
    ).rejects.toThrow(AuthError);
  });

  it('upgrading one guest never affects a different guest\'s account', async () => {
    const { repo, service } = ctx;
    const guestA = await service.createGuestSession();
    const guestB = await service.createGuestSession();

    // The route layer (routes.ts) always derives actorUserId from the
    // caller's OWN verified access token — there is no request field a
    // client can set to name a different account. This test proves the
    // service-layer half of that guarantee: upgrading B's id can never
    // touch A's row.
    await service.upgradeGuest(guestB.userId, 'b@example.com', 'hunter2hunter2');

    const stillGuestA = await repo.findById(guestA.userId);
    expect(stillGuestA?.isGuest).toBe(true);
  });
});
