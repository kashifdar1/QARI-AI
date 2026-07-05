import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { auditEvents, passages, quranAyahWords, quranContentVersions } from '../db/schema/index.js';
import type {
  AuditEventInput,
  AyahWordRecord,
  ContentRepository,
  ContentVersionRecord,
  NewContentVersion,
  NewPassage,
  PassageRecord,
} from './contentRepository.js';

export class DrizzleContentRepository implements ContentRepository {
  constructor(private readonly db: Db) {}

  async insertContentVersion(version: NewContentVersion): Promise<ContentVersionRecord> {
    const [row] = await this.db.insert(quranContentVersions).values(version).returning();
    if (!row) throw new Error('insert did not return a row');
    return toVersionRecord(row);
  }

  async insertWords(words: AyahWordRecord[]): Promise<void> {
    if (words.length === 0) return;
    // Postgres bind-parameter limits mean large corpora (6236 ayat, tens of
    // thousands of words) must be batched rather than inserted in one call.
    const BATCH_SIZE = 500;
    for (let i = 0; i < words.length; i += BATCH_SIZE) {
      await this.db.insert(quranAyahWords).values(words.slice(i, i + BATCH_SIZE));
    }
  }

  async approveContentVersion(id: string, reviewerName: string): Promise<ContentVersionRecord> {
    const [row] = await this.db
      .update(quranContentVersions)
      .set({ reviewStatus: 'approved', reviewedBy: reviewerName, reviewedAt: new Date() })
      .where(eq(quranContentVersions.id, id))
      .returning();
    if (!row) throw new Error(`No content version with id ${id}`);
    return toVersionRecord(row);
  }

  async findContentVersion(id: string): Promise<ContentVersionRecord | null> {
    const [row] = await this.db
      .select()
      .from(quranContentVersions)
      .where(eq(quranContentVersions.id, id))
      .limit(1);
    return row ? toVersionRecord(row) : null;
  }

  async findApprovedContentVersion(): Promise<ContentVersionRecord | null> {
    const [row] = await this.db
      .select()
      .from(quranContentVersions)
      .where(eq(quranContentVersions.reviewStatus, 'approved'))
      .limit(1);
    return row ? toVersionRecord(row) : null;
  }

  async insertPassage(passage: NewPassage): Promise<PassageRecord> {
    const [row] = await this.db.insert(passages).values(passage).returning();
    if (!row) throw new Error('insert did not return a row');
    return toPassageRecord(row);
  }

  async listPassages(contentVersionId: string): Promise<PassageRecord[]> {
    const rows = await this.db
      .select()
      .from(passages)
      .where(eq(passages.contentVersionId, contentVersionId));
    return rows.map(toPassageRecord);
  }

  async findPassage(id: string): Promise<PassageRecord | null> {
    const [row] = await this.db.select().from(passages).where(eq(passages.id, id)).limit(1);
    return row ? toPassageRecord(row) : null;
  }

  async getAyahWords(
    contentVersionId: string,
    surahNumber: number,
    ayahNumber: number,
  ): Promise<AyahWordRecord[]> {
    const rows = await this.db
      .select()
      .from(quranAyahWords)
      .where(
        and(
          eq(quranAyahWords.contentVersionId, contentVersionId),
          eq(quranAyahWords.surahNumber, surahNumber),
          eq(quranAyahWords.ayahNumber, ayahNumber),
        ),
      )
      .orderBy(quranAyahWords.wordIndex);
    return rows;
  }

  async recordAuditEvent(event: AuditEventInput): Promise<void> {
    await this.db.insert(auditEvents).values({
      eventType: event.eventType,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      actorUserId: event.actorUserId ?? null,
      metadata: event.metadata ?? null,
    });
  }
}

function toVersionRecord(row: typeof quranContentVersions.$inferSelect): ContentVersionRecord {
  return {
    id: row.id,
    riwayah: row.riwayah,
    source: row.source,
    sourceChecksum: row.sourceChecksum,
    reviewStatus: row.reviewStatus,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
  };
}

function toPassageRecord(row: typeof passages.$inferSelect): PassageRecord {
  return {
    id: row.id,
    contentVersionId: row.contentVersionId,
    surahNumber: row.surahNumber,
    ayahStart: row.ayahStart,
    ayahEnd: row.ayahEnd,
    riwayah: row.riwayah,
  };
}
