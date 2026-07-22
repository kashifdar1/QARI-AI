export type Profile = {
  id: string;
  ownerUserId: string;
  displayName: string;
  profileType: 'adult' | 'child';
  locale: 'en' | 'ur' | 'ar';
};

export type PracticeSession = {
  id: string;
  profileId: string;
  passageId: string;
};

/**
 * Client for profile + practice-session creation
 * (services/api/src/sessions/routes.ts) — the piece that was missing
 * entirely until this session: attempts are created against a practice
 * session, and a session is created against a profile, but nothing in the
 * app could create either row before this.
 */
export class SessionClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getAccessToken: () => string,
  ) {}

  private authHeaders(): Record<string, string> {
    return { authorization: `Bearer ${this.getAccessToken()}` };
  }

  async createProfile(displayName: string, profileType: 'adult' | 'child'): Promise<Profile> {
    const response = await fetch(`${this.baseUrl}/profiles`, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ displayName, profileType }),
    });
    if (!response.ok) throw new Error(`Failed to create profile (${response.status})`);
    return (await response.json()) as Profile;
  }

  async createPracticeSession(profileId: string, passageId: string): Promise<PracticeSession> {
    const response = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ profileId, passageId }),
    });
    if (!response.ok) throw new Error(`Failed to create practice session (${response.status})`);
    return (await response.json()) as PracticeSession;
  }
}
