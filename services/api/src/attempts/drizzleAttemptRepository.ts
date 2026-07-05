import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { attempts, practiceSessions, profiles } from '../db/schema/index.js';
import type {
  AttemptRecord,
  AttemptRepository,
  AttemptStatus,
  IdempotentCreateResult,
  SessionOwnership,
} from './attemptRepository.js';

export class DrizzleAttemptRepository implements AttemptRepository {
  constructor(private readonly db: Db) {}

  async createAttemptIdempotent(sessionId: string, clientAttemptId: string): Promise<IdempotentCreateResult> {
    const [inserted] = await this.db
      .insert(attempts)
      .values({ sessionId, clientAttemptId })
      .onConflictDoNothing({ target: [attempts.sessionId, attempts.clientAttemptId] })
      .returning();
    if (inserted) return { attempt: toRecord(inserted), created: true };

    const [existing] = await this.db
      .select()
      .from(attempts)
      .where(and(eq(attempts.sessionId, sessionId), eq(attempts.clientAttemptId, clientAttemptId)))
      .limit(1);
    if (!existing) throw new Error('Idempotent insert conflicted but no existing row was found');
    return { attempt: toRecord(existing), created: false };
  }

  async findById(id: string): Promise<AttemptRecord | null> {
    const [row] = await this.db.select().from(attempts).where(eq(attempts.id, id)).limit(1);
    return row ? toRecord(row) : null;
  }

  async updateStatus(id: string, status: AttemptStatus, objectKey?: string): Promise<AttemptRecord> {
    const [row] = await this.db
      .update(attempts)
      .set({ status, ...(objectKey ? { objectKey } : {}), updatedAt: new Date() })
      .where(eq(attempts.id, id))
      .returning();
    if (!row) throw new Error(`No attempt with id ${id}`);
    return toRecord(row);
  }

  async findSessionOwnership(sessionId: string): Promise<SessionOwnership | null> {
    const [row] = await this.db
      .select({ profileId: profiles.id, ownerUserId: profiles.ownerUserId })
      .from(practiceSessions)
      .innerJoin(profiles, eq(practiceSessions.profileId, profiles.id))
      .where(eq(practiceSessions.id, sessionId))
      .limit(1);
    return row ? { sessionId, profileId: row.profileId, ownerUserId: row.ownerUserId } : null;
  }

  async findOwnershipForAttempt(attemptId: string): Promise<SessionOwnership | null> {
    const [row] = await this.db
      .select({
        sessionId: practiceSessions.id,
        profileId: profiles.id,
        ownerUserId: profiles.ownerUserId,
      })
      .from(attempts)
      .innerJoin(practiceSessions, eq(attempts.sessionId, practiceSessions.id))
      .innerJoin(profiles, eq(practiceSessions.profileId, profiles.id))
      .where(eq(attempts.id, attemptId))
      .limit(1);
    return row ?? null;
  }
}

function toRecord(row: typeof attempts.$inferSelect): AttemptRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    clientAttemptId: row.clientAttemptId,
    status: row.status,
    retentionState: row.retentionState,
    objectKey: row.objectKey,
    teacherReviewAvailable: row.teacherReviewAvailable,
  };
}
