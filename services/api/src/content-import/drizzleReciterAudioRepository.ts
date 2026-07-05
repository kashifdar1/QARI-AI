import { inArray } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { reciterAudio } from '../db/schema/index.js';
import type { NewReciterAudio, ReciterAudioRecord, ReciterAudioRepository } from './reciterAudioRepository.js';

export class DrizzleReciterAudioRepository implements ReciterAudioRepository {
  constructor(private readonly db: Db) {}

  async insert(record: NewReciterAudio): Promise<ReciterAudioRecord> {
    const [row] = await this.db
      .insert(reciterAudio)
      .values({
        passageId: record.passageId,
        reciterId: record.reciterId,
        reciterName: record.reciterName,
        licenseName: record.licenseName,
        licenseUrl: record.licenseUrl,
        objectKey: record.objectKey,
        isPlaceholder: String(record.isPlaceholder),
      })
      .returning();
    if (!row) throw new Error('insert did not return a row');
    return toRecord(row);
  }

  async listByPassageIds(passageIds: string[]): Promise<ReciterAudioRecord[]> {
    if (passageIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(reciterAudio)
      .where(inArray(reciterAudio.passageId, passageIds));
    return rows.map(toRecord);
  }
}

function toRecord(row: typeof reciterAudio.$inferSelect): ReciterAudioRecord {
  return {
    id: row.id,
    passageId: row.passageId,
    reciterId: row.reciterId,
    reciterName: row.reciterName,
    licenseName: row.licenseName,
    licenseUrl: row.licenseUrl,
    objectKey: row.objectKey,
    isPlaceholder: row.isPlaceholder === 'true',
  };
}
