export type ProfileRecord = {
  id: string;
  ownerUserId: string;
  displayName: string;
  profileType: 'adult' | 'child';
  locale: 'en' | 'ur' | 'ar';
};

export type NewProfile = {
  ownerUserId: string;
  displayName: string;
  profileType: 'adult' | 'child';
  locale: 'en' | 'ur' | 'ar';
};

/**
 * Port for profile persistence — same pattern as auth/userRepository.ts
 * and content-import/contentRepository.ts. A profile is the practicing
 * individual (guardian or child), owned by exactly one user (Principle 5:
 * child profiles are guardian-created and guardian-managed).
 */
export type ProfileRepository = {
  insert(profile: NewProfile): Promise<ProfileRecord>;
  findById(id: string): Promise<ProfileRecord | null>;
};

export class InMemoryProfileRepository implements ProfileRepository {
  private profiles = new Map<string, ProfileRecord>();
  private nextId = 1;

  async insert(profile: NewProfile): Promise<ProfileRecord> {
    const record: ProfileRecord = { id: `profile-${this.nextId++}`, ...profile };
    this.profiles.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<ProfileRecord | null> {
    return this.profiles.get(id) ?? null;
  }
}
