export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  locale: 'en' | 'ur' | 'ar';
  isGuest: boolean;
};

export type NewUser = Omit<UserRecord, 'id'>;

/**
 * Port for user persistence. AuthService depends only on this interface —
 * unit tests use InMemoryUserRepository (no Postgres needed); production
 * wiring (services/api/src/server.ts) uses DrizzleUserRepository. This is
 * what lets auth/authorization logic hit the CLAUDE.md §5 coverage bar
 * without a live database in CI or in this environment.
 */
export type UserRepository = {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  insert(user: NewUser): Promise<UserRecord>;
  update(id: string, patch: Partial<Omit<UserRecord, 'id'>>): Promise<UserRecord>;
};

export class InMemoryUserRepository implements UserRepository {
  private usersById = new Map<string, UserRecord>();
  private nextId = 1;

  async findByEmail(email: string): Promise<UserRecord | null> {
    for (const user of this.usersById.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.usersById.get(id) ?? null;
  }

  async insert(user: NewUser): Promise<UserRecord> {
    const id = `user-${this.nextId++}`;
    const record: UserRecord = { ...user, id };
    this.usersById.set(id, record);
    return record;
  }

  async update(id: string, patch: Partial<Omit<UserRecord, 'id'>>): Promise<UserRecord> {
    const existing = this.usersById.get(id);
    if (!existing) {
      throw new Error(`No user with id ${id}`);
    }
    const updated: UserRecord = { ...existing, ...patch };
    this.usersById.set(id, updated);
    return updated;
  }
}
