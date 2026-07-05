import type { ContentRepository, ContentVersionRecord, PassageRecord } from '../content-import/contentRepository.js';
import type { ReciterAudioRepository } from '../content-import/reciterAudioRepository.js';
import { notFound } from '../errors.js';

export type PassageSummaryDto = {
  id: string;
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
  riwayah: 'hafs_an_asim';
};

export type PassageDetailDto = PassageSummaryDto & {
  referenceAudioUrl: string | null;
  reciterId: string | null;
  ayahs: Array<{
    ayahNumber: number;
    words: Array<{ wordIndex: number; displayText: string }>;
  }>;
  translation: {
    available: false;
    reason: 'no_cleared_translation_license';
  };
};

export class ContentService {
  constructor(
    private readonly contentRepo: ContentRepository,
    private readonly reciterAudioRepo: ReciterAudioRepository,
    private readonly publicObjectBaseUrl: string,
  ) {}

  private async requireApprovedVersion(): Promise<ContentVersionRecord> {
    const version = await this.contentRepo.findApprovedContentVersion();
    if (!version) {
      throw notFound('No approved content version is available yet');
    }
    return version;
  }

  /** ETag for list/detail responses — changes iff the servable content version changes. */
  async getContentEtag(): Promise<string> {
    const version = await this.requireApprovedVersion();
    return `"${version.sourceChecksum}"`;
  }

  async listPassages(surahNumber?: number): Promise<PassageSummaryDto[]> {
    const version = await this.requireApprovedVersion();
    const passages = await this.contentRepo.listPassages(version.id);
    const filtered = surahNumber ? passages.filter((p) => p.surahNumber === surahNumber) : passages;
    return filtered.map(toSummary).sort((a, b) => a.surahNumber - b.surahNumber);
  }

  async getPassageDetail(passageId: string): Promise<PassageDetailDto> {
    await this.requireApprovedVersion();
    const passage = await this.contentRepo.findPassage(passageId);
    if (!passage) {
      throw notFound(`No passage with id ${passageId}`);
    }

    const ayahs = [];
    for (let ayahNumber = passage.ayahStart; ayahNumber <= passage.ayahEnd; ayahNumber++) {
      const words = await this.contentRepo.getAyahWords(
        passage.contentVersionId,
        passage.surahNumber,
        ayahNumber,
      );
      ayahs.push({
        ayahNumber,
        words: words.map((w) => ({ wordIndex: w.wordIndex, displayText: w.displayText })),
      });
    }

    const [audio] = await this.reciterAudioRepo.listByPassageIds([passage.id]);

    return {
      ...toSummary(passage),
      referenceAudioUrl: audio ? `${this.publicObjectBaseUrl}/${audio.objectKey}` : null,
      reciterId: audio?.reciterId ?? null,
      ayahs,
      translation: { available: false, reason: 'no_cleared_translation_license' },
    };
  }
}

function toSummary(passage: PassageRecord): PassageSummaryDto {
  return {
    id: passage.id,
    surahNumber: passage.surahNumber,
    ayahStart: passage.ayahStart,
    ayahEnd: passage.ayahEnd,
    riwayah: passage.riwayah,
  };
}
