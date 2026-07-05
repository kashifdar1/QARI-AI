import type { PassageRecord } from './contentRepository.js';
import type { ReciterAudioRecord } from './reciterAudioRepository.js';

export type ManifestIssue =
  | { kind: 'missing_audio_row'; passageId: string; surahNumber: number }
  | { kind: 'object_not_found'; passageId: string; surahNumber: number; objectKey: string };

export type AudioManifestReport = {
  ok: boolean;
  checkedPassageCount: number;
  issues: ManifestIssue[];
};

/**
 * Validates that every passage in the set has a ReciterAudio row AND that
 * the referenced object actually exists in storage. `objectExists` is
 * injected so this is testable without a live object store — production
 * wiring points it at a real HEAD-object check against
 * OBJECT_STORAGE_ENDPOINT (services/api/src/content-import/audioManifestCli.ts
 * currently checks the local placeholder-audio directory instead, since no
 * MinIO/S3 instance is running in this development environment; see the
 * milestone risk notes).
 */
export async function buildAudioManifest(
  passages: PassageRecord[],
  reciterAudio: ReciterAudioRecord[],
  objectExists: (key: string) => Promise<boolean>,
): Promise<AudioManifestReport> {
  const audioByPassage = new Map(reciterAudio.map((r) => [r.passageId, r]));
  const issues: ManifestIssue[] = [];

  for (const passage of passages) {
    const audio = audioByPassage.get(passage.id);
    if (!audio) {
      issues.push({ kind: 'missing_audio_row', passageId: passage.id, surahNumber: passage.surahNumber });
      continue;
    }
    const exists = await objectExists(audio.objectKey);
    if (!exists) {
      issues.push({
        kind: 'object_not_found',
        passageId: passage.id,
        surahNumber: passage.surahNumber,
        objectKey: audio.objectKey,
      });
    }
  }

  return { ok: issues.length === 0, checkedPassageCount: passages.length, issues };
}
