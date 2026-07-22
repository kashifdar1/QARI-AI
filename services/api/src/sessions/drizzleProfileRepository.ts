import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { profiles } from '../db/schema/index.js';
import type { NewProfile, ProfileRecord, ProfileRepository } from './profileRepository.js';

export class DrizzleProfileRepository implements ProfileRepository {
  constructor(private readonly db: Db) {}

  async insert(profile: NewProfile): Promise<ProfileRecord> {
    const [row] = await this.db.insert(profiles).values(profile).returning();
    if (!row) throw new Error('Profile insert returned no row');
    return toRecord(row);
  }

  async findById(id: string): Promise<ProfileRecord | null> {
    const [row] = await this.db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    return row ? toRecord(row) : null;
  }
}

function toRecord(row: typeof profiles.$inferSelect): ProfileRecord {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    displayName: row.displayName,
    profileType: row.profileType,
    locale: row.locale,
  };
}
