export type PassageSummary = {
  id: string;
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
  riwayah: 'hafs_an_asim';
};

export type PassageWord = { wordIndex: number; displayText: string };
export type PassageAyah = { ayahNumber: number; words: PassageWord[] };

export type PassageDetail = PassageSummary & {
  referenceAudioUrl: string | null;
  reciterId: string | null;
  ayahs: PassageAyah[];
  translation: { available: boolean; reason?: string | null };
};

export class ContentApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Thin typed wrapper over the public content endpoints
 * (packages/api-contracts/openapi.yaml). No auth header — these routes are
 * public-read (ADR: content is rate-limited, not auth-gated).
 */
export class ContentClient {
  constructor(private readonly baseUrl: string) {}

  async listPassages(surahNumber?: number): Promise<PassageSummary[]> {
    const url = new URL(`${this.baseUrl}/content/passages`);
    if (surahNumber) url.searchParams.set('surahNumber', String(surahNumber));
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new ContentApiError(response.status, `Failed to list passages (${response.status})`);
    }
    const body = (await response.json()) as { items: PassageSummary[] };
    return body.items;
  }

  async getPassageDetail(passageId: string): Promise<PassageDetail> {
    const response = await fetch(`${this.baseUrl}/content/passages/${passageId}`);
    if (!response.ok) {
      throw new ContentApiError(response.status, `Failed to load passage (${response.status})`);
    }
    return (await response.json()) as PassageDetail;
  }
}
