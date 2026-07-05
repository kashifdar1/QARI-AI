export type NewContentVersion = {
  riwayah: 'hafs_an_asim';
  source: 'tanzil_net_uthmani';
  sourceChecksum: string;
};

export type ContentVersionRecord = NewContentVersion & {
  id: string;
  reviewStatus: 'imported' | 'approved' | 'rolled_back';
  reviewedBy: string | null;
  reviewedAt: Date | null;
};

export type AyahWordRecord = {
  contentVersionId: string;
  surahNumber: number;
  ayahNumber: number;
  wordIndex: number;
  displayText: string;
  normalizedText: string;
};

export type PassageRecord = {
  id: string;
  contentVersionId: string;
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
  riwayah: 'hafs_an_asim';
};

export type NewPassage = Omit<PassageRecord, 'id'>;

export type AuditEventInput = {
  eventType: string;
  subjectType: string;
  subjectId: string;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Port for content persistence — same pattern as services/api/src/auth's
 * UserRepository (ADR pattern, not a new decision): AuthService/import
 * orchestration depend only on this interface, so import/approve logic is
 * unit-testable without a live Postgres (no Postgres is available in this
 * development environment; see the milestone risk notes).
 */
export type ContentRepository = {
  insertContentVersion(version: NewContentVersion): Promise<ContentVersionRecord>;
  insertWords(words: AyahWordRecord[]): Promise<void>;
  approveContentVersion(id: string, reviewerName: string): Promise<ContentVersionRecord>;
  findContentVersion(id: string): Promise<ContentVersionRecord | null>;
  findApprovedContentVersion(): Promise<ContentVersionRecord | null>;
  insertPassage(passage: NewPassage): Promise<PassageRecord>;
  listPassages(contentVersionId: string): Promise<PassageRecord[]>;
  findPassage(id: string): Promise<PassageRecord | null>;
  getAyahWords(
    contentVersionId: string,
    surahNumber: number,
    ayahNumber: number,
  ): Promise<AyahWordRecord[]>;
  recordAuditEvent(event: AuditEventInput): Promise<void>;
};

export class InMemoryContentRepository implements ContentRepository {
  private versions = new Map<string, ContentVersionRecord>();
  private words: AyahWordRecord[] = [];
  private passages = new Map<string, PassageRecord>();
  private nextId = 1;

  private id(prefix: string): string {
    return `${prefix}-${this.nextId++}`;
  }

  async insertContentVersion(version: NewContentVersion): Promise<ContentVersionRecord> {
    const record: ContentVersionRecord = {
      ...version,
      id: this.id('content-version'),
      reviewStatus: 'imported',
      reviewedBy: null,
      reviewedAt: null,
    };
    this.versions.set(record.id, record);
    return record;
  }

  async insertWords(words: AyahWordRecord[]): Promise<void> {
    this.words.push(...words);
  }

  async approveContentVersion(id: string, reviewerName: string): Promise<ContentVersionRecord> {
    const existing = this.versions.get(id);
    if (!existing) throw new Error(`No content version with id ${id}`);
    const updated: ContentVersionRecord = {
      ...existing,
      reviewStatus: 'approved',
      reviewedBy: reviewerName,
      reviewedAt: new Date(),
    };
    this.versions.set(id, updated);
    return updated;
  }

  async findContentVersion(id: string): Promise<ContentVersionRecord | null> {
    return this.versions.get(id) ?? null;
  }

  async findApprovedContentVersion(): Promise<ContentVersionRecord | null> {
    for (const version of this.versions.values()) {
      if (version.reviewStatus === 'approved') return version;
    }
    return null;
  }

  async insertPassage(passage: NewPassage): Promise<PassageRecord> {
    const record: PassageRecord = { ...passage, id: this.id('passage') };
    this.passages.set(record.id, record);
    return record;
  }

  async listPassages(contentVersionId: string): Promise<PassageRecord[]> {
    return [...this.passages.values()].filter((p) => p.contentVersionId === contentVersionId);
  }

  async findPassage(id: string): Promise<PassageRecord | null> {
    return this.passages.get(id) ?? null;
  }

  async getAyahWords(
    contentVersionId: string,
    surahNumber: number,
    ayahNumber: number,
  ): Promise<AyahWordRecord[]> {
    return this.words
      .filter(
        (w) =>
          w.contentVersionId === contentVersionId &&
          w.surahNumber === surahNumber &&
          w.ayahNumber === ayahNumber,
      )
      .sort((a, b) => a.wordIndex - b.wordIndex);
  }

  auditEvents: AuditEventInput[] = [];

  async recordAuditEvent(event: AuditEventInput): Promise<void> {
    this.auditEvents.push(event);
  }
}
