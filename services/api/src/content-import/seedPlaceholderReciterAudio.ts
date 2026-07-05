import type { ContentRepository, PassageRecord } from './contentRepository.js';
import { placeholderObjectKey } from './placeholderAudio.js';
import type { ReciterAudioRecord, ReciterAudioRepository } from './reciterAudioRepository.js';

// reciter_audio.reciter_id is a uuid column; this is a fixed placeholder id,
// not a real reciter record.
const PLACEHOLDER_RECITER_ID = '00000000-0000-0000-0000-000000000001';
const PLACEHOLDER_RECITER_NAME = 'PLACEHOLDER_AUDIO (no cleared reciter yet)';
const PLACEHOLDER_LICENSE_NAME = 'N/A — silent generated audio, no copyrighted recitation';

/**
 * One ReciterAudio row per MVP passage, all pointing at generated silent
 * WAV placeholders (Stub Policy) until a real reciter is cleared
 * (docs/licenses/, docs/STUBS.md). Never generates or references anything
 * claiming to be an actual recitation.
 */
export async function seedPlaceholderReciterAudio(
  reciterAudioRepo: ReciterAudioRepository,
  contentRepo: ContentRepository,
  passages: PassageRecord[],
): Promise<ReciterAudioRecord[]> {
  const created: ReciterAudioRecord[] = [];
  for (const passage of passages) {
    const row = await reciterAudioRepo.insert({
      passageId: passage.id,
      reciterId: PLACEHOLDER_RECITER_ID,
      reciterName: PLACEHOLDER_RECITER_NAME,
      licenseName: PLACEHOLDER_LICENSE_NAME,
      licenseUrl: null,
      objectKey: placeholderObjectKey(passage.surahNumber),
      isPlaceholder: true,
    });
    created.push(row);
  }
  await contentRepo.recordAuditEvent({
    eventType: 'reciter_audio.placeholder_seeded',
    subjectType: 'quran_content_version',
    subjectId: passages[0]?.contentVersionId ?? 'unknown',
    metadata: { passageCount: passages.length },
  });
  return created;
}
