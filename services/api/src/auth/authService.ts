import { generateUnusablePassword, hashPassword, verifyPassword } from './password.js';
import { signAccessToken, signRefreshToken } from './jwt.js';
import type { UserRepository } from './userRepository.js';

export class AuthError extends Error {
  constructor(
    public readonly code: 'EMAIL_TAKEN' | 'INVALID_CREDENTIALS' | 'NOT_A_GUEST' | 'FORBIDDEN',
    message: string,
  ) {
    super(message);
  }
}

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
};

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwtSecret: string,
  ) {}

  async signup(email: string, password: string, locale: 'en' | 'ur' | 'ar' = 'en'): Promise<AuthSession> {
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new AuthError('EMAIL_TAKEN', `An account already exists for ${email}`);
    }
    const user = await this.users.insert({
      email,
      passwordHash: hashPassword(password),
      locale,
      isGuest: false,
    });
    return this.issueSession(user.id, false);
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const user = await this.users.findByEmail(email);
    if (!user || user.isGuest || !verifyPassword(password, user.passwordHash)) {
      // Same error for "no such user" and "wrong password" — do not leak
      // which one it was.
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
    }
    return this.issueSession(user.id, false);
  }

  /** Creates a real `users` row (isGuest: true) with no usable password, so profile-owning FKs work unchanged from day one. */
  async createGuestSession(): Promise<AuthSession> {
    const user = await this.users.insert({
      email: `guest+${crypto.randomUUID()}@guest.qari.local`,
      passwordHash: hashPassword(generateUnusablePassword()),
      locale: 'en',
      isGuest: true,
    });
    return this.issueSession(user.id, true);
  }

  /**
   * Converts the CALLER's own guest account into a full account. `actorUserId`
   * comes from the caller's own verified access token — a guest can only
   * upgrade themselves, never another guest's account (object-level check,
   * same principle as packages/domain's canAccessProfile).
   */
  async upgradeGuest(actorUserId: string, email: string, password: string): Promise<AuthSession> {
    const actor = await this.users.findById(actorUserId);
    if (!actor) {
      throw new AuthError('FORBIDDEN', 'Unknown account');
    }
    if (!actor.isGuest) {
      throw new AuthError('NOT_A_GUEST', 'This account has already been upgraded');
    }
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new AuthError('EMAIL_TAKEN', `An account already exists for ${email}`);
    }
    const upgraded = await this.users.update(actor.id, {
      email,
      passwordHash: hashPassword(password),
      isGuest: false,
    });
    return this.issueSession(upgraded.id, false);
  }

  private issueSession(userId: string, guest: boolean): AuthSession {
    return {
      accessToken: signAccessToken({ sub: userId, guest }, this.jwtSecret),
      refreshToken: signRefreshToken({ sub: userId, guest }, this.jwtSecret),
      userId,
    };
  }
}
