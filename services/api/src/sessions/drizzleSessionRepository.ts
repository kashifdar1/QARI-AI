import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { practiceSessions } from '../db/schema/index.js';
import type { NewPracticeSession, PracticeSessionRecord, SessionRepository } from './sessionRepository.js';

export class DrizzleSessionRepository implements SessionRepository {
  constructor(private readonly db: Db) {}

  async insert(session: NewPracticeSession): Promise<PracticeSessionRecord> {
    const [row] = await this.db.insert(practiceSessions).values(session).returning();
    if (!row) throw new Error('Practice session insert returned no row');
    return toRecord(row);
  }

  async findById(id: string): Promise<PracticeSessionRecord | null> {
    const [row] = await this.db.select().from(practiceSessions).where(eq(practiceSessions.id, id)).limit(1);
    return row ? toRecord(row) : null;
  }
}

function toRecord(row: typeof practiceSessions.$inferSelect): PracticeSessionRecord {
  return { id: row.id, profileId: row.profileId, passageId: row.passageId };
}
