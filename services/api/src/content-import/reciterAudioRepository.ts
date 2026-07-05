export type NewReciterAudio = {
  passageId: string;
  reciterId: string;
  reciterName: string;
  licenseName: string;
  licenseUrl: string | null;
  objectKey: string;
  isPlaceholder: boolean;
};

export type ReciterAudioRecord = NewReciterAudio & { id: string };

export type ReciterAudioRepository = {
  insert(record: NewReciterAudio): Promise<ReciterAudioRecord>;
  listByPassageIds(passageIds: string[]): Promise<ReciterAudioRecord[]>;
};

export class InMemoryReciterAudioRepository implements ReciterAudioRepository {
  private rows: ReciterAudioRecord[] = [];
  private nextId = 1;

  async insert(record: NewReciterAudio): Promise<ReciterAudioRecord> {
    const row: ReciterAudioRecord = { ...record, id: `reciter-audio-${this.nextId++}` };
    this.rows.push(row);
    return row;
  }

  async listByPassageIds(passageIds: string[]): Promise<ReciterAudioRecord[]> {
    const ids = new Set(passageIds);
    return this.rows.filter((r) => ids.has(r.passageId));
  }
}
