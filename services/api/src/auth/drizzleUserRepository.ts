import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { users } from '../db/schema/index.js';
import type { NewUser, UserRecord, UserRepository } from './userRepository.js';

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Db) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return row ? toRecord(row) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? toRecord(row) : null;
  }

  async insert(user: NewUser): Promise<UserRecord> {
    const [row] = await this.db
      .insert(users)
      .values({
        email: user.email,
        passwordHash: user.passwordHash,
        locale: user.locale,
        isGuest: user.isGuest,
      })
      .returning();
    if (!row) throw new Error('insert did not return a row');
    return toRecord(row);
  }

  async update(id: string, patch: Partial<Omit<UserRecord, 'id'>>): Promise<UserRecord> {
    const [row] = await this.db
      .update(users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!row) throw new Error(`No user with id ${id}`);
    return toRecord(row);
  }
}

function toRecord(row: typeof users.$inferSelect): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    locale: row.locale,
    isGuest: row.isGuest,
  };
}
