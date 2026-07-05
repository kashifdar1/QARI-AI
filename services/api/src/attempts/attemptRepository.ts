export type AttemptStatus =
  | 'ready'
  | 'uploading'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'needs_rerecord'
  | 'failed';

export type AttemptRecord = {
  id: string;
  sessionId: string;
  clientAttemptId: string;
  status: AttemptStatus;
  retentionState: 'active' | 'pending_deletion' | 'deleted';
  objectKey: string | null;
  teacherReviewAvailable: boolean;
};

export type SessionOwnership = {
  sessionId: string;
  profileId: string;
  ownerUserId: string;
};

/**
 * Port for attempt persistence + the session/profile ownership lookup
 * object-level authorization needs (CLAUDE.md §5: "a user cannot fetch
 * another user's attempt"). Same pattern as auth/userRepository.ts and
 * content-import/contentRepository.ts — unit-testable without a live
 * Postgres.
 */
export type IdempotentCreateResult = {
  attempt: AttemptRecord;
  created: boolean;
};

export type AttemptRepository = {
  /** Inserts, or if (sessionId, clientAttemptId) already exists, returns the existing row — the idempotency mechanism. `created` tells the caller which happened (201 vs 200). */
  createAttemptIdempotent(sessionId: string, clientAttemptId: string): Promise<IdempotentCreateResult>;
  findById(id: string): Promise<AttemptRecord | null>;
  updateStatus(id: string, status: AttemptStatus, objectKey?: string): Promise<AttemptRecord>;
  findSessionOwnership(sessionId: string): Promise<SessionOwnership | null>;
  findOwnershipForAttempt(attemptId: string): Promise<SessionOwnership | null>;
};

export class InMemoryAttemptRepository implements AttemptRepository {
  private attempts = new Map<string, AttemptRecord>();
  private sessionOwnerships = new Map<string, SessionOwnership>();
  private nextId = 1;

  /** Test/seed helper — not part of the port, since real session creation lives elsewhere. */
  seedSession(sessionId: string, profileId: string, ownerUserId: string): void {
    this.sessionOwnerships.set(sessionId, { sessionId, profileId, ownerUserId });
  }

  async createAttemptIdempotent(sessionId: string, clientAttemptId: string): Promise<IdempotentCreateResult> {
    const existing = [...this.attempts.values()].find(
      (a) => a.sessionId === sessionId && a.clientAttemptId === clientAttemptId,
    );
    if (existing) return { attempt: existing, created: false };

    const record: AttemptRecord = {
      id: `attempt-${this.nextId++}`,
      sessionId,
      clientAttemptId,
      status: 'ready',
      retentionState: 'active',
      objectKey: null,
      teacherReviewAvailable: false,
    };
    this.attempts.set(record.id, record);
    return { attempt: record, created: true };
  }

  async findById(id: string): Promise<AttemptRecord | null> {
    return this.attempts.get(id) ?? null;
  }

  async updateStatus(id: string, status: AttemptStatus, objectKey?: string): Promise<AttemptRecord> {
    const existing = this.attempts.get(id);
    if (!existing) throw new Error(`No attempt with id ${id}`);
    const updated: AttemptRecord = { ...existing, status, objectKey: objectKey ?? existing.objectKey };
    this.attempts.set(id, updated);
    return updated;
  }

  async findSessionOwnership(sessionId: string): Promise<SessionOwnership | null> {
    return this.sessionOwnerships.get(sessionId) ?? null;
  }

  async findOwnershipForAttempt(attemptId: string): Promise<SessionOwnership | null> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt) return null;
    return this.sessionOwnerships.get(attempt.sessionId) ?? null;
  }
}
