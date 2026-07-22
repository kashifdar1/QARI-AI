export type AuthSession = {
  accessToken: string;
  userId: string;
};

/**
 * Thin client for the guest-session bootstrap
 * (services/api/src/auth/routes.ts). Full signup/login UI is out of scope
 * here — CLAUDE.md's resolved decision names "guest session issuance +
 * account creation + guest→account upgrade path" as the auth surface, and
 * a guest session is the minimum needed to exercise the record → upload →
 * evaluate → feedback loop end to end. The session is kept in memory only
 * (not persisted across app restarts) — creating a new guest session is
 * cheap and this MVP doesn't yet need cross-restart identity.
 */
export class AuthClient {
  constructor(private readonly baseUrl: string) {}

  async createGuestSession(): Promise<AuthSession> {
    const response = await fetch(`${this.baseUrl}/auth/guest-session`, { method: 'POST' });
    if (!response.ok) throw new Error(`Failed to create guest session (${response.status})`);
    const body = (await response.json()) as { accessToken: string; userId: string };
    return { accessToken: body.accessToken, userId: body.userId };
  }
}
