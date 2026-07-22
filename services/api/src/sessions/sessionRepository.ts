export type PracticeSessionRecord = {
  id: string;
  profileId: string;
  passageId: string;
};

export type NewPracticeSession = {
  profileId: string;
  passageId: string;
};

/**
 * Port for practice-session persistence. A session groups attempts against
 * one passage for one profile (`docs/mobile-architecture.md`); attempts
 * reference a session, not a passage/profile directly, so retry history
 * for the same passage stays grouped (Milestone C task 4: "Retry from
 * feedback creates a new attempt in the same session").
 */
export type SessionRepository = {
  insert(session: NewPracticeSession): Promise<PracticeSessionRecord>;
  findById(id: string): Promise<PracticeSessionRecord | null>;
};

export class InMemorySessionRepository implements SessionRepository {
  private sessions = new Map<string, PracticeSessionRecord>();
  private nextId = 1;

  async insert(session: NewPracticeSession): Promise<PracticeSessionRecord> {
    const record: PracticeSessionRecord = { id: `session-${this.nextId++}`, ...session };
    this.sessions.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<PracticeSessionRecord | null> {
    return this.sessions.get(id) ?? null;
  }
}
