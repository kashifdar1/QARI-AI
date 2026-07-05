import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { InMemoryAttemptRepository } from './attemptRepository.js';
import { InMemoryContentRepository } from '../content-import/contentRepository.js';
import { importTanzilContent } from '../content-import/importCommand.js';
import { processAttempt } from './evaluationOrchestrator.js';
import { InMemoryEvaluationResultRepository } from './evaluationResultRepository.js';
import type { InferenceClient, InferenceEvaluateResponse } from './inferenceClient.js';
import { FakeObjectStorageReader } from './objectStorageReader.js';

const TEXT_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-uthmani-v1.1.txt', import.meta.url),
);
const METADATA_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-quran-metadata-v1.0.xml', import.meta.url),
);

class FakeInferenceClient implements InferenceClient {
  constructor(private readonly response: InferenceEvaluateResponse) {}
  async evaluate(): Promise<InferenceEvaluateResponse> {
    return this.response;
  }
}

async function setUp() {
  const attemptRepository = new InMemoryAttemptRepository();
  const contentRepository = new InMemoryContentRepository();
  const evaluationResultRepository = new InMemoryEvaluationResultRepository();
  const objectStorageReader = new FakeObjectStorageReader();

  const { contentVersion } = await importTanzilContent(contentRepository, TEXT_PATH, METADATA_PATH);

  attemptRepository.seedSession('session-1', 'profile-1', 'user-1');
  const { attempt } = await attemptRepository.createAttemptIdempotent('session-1', 'client-attempt-1');
  await attemptRepository.updateStatus(attempt.id, 'queued', 'attempts/attempt-1.wav');
  objectStorageReader.seed('attempts/attempt-1.wav', 'ZmFrZS1hdWRpby1ieXRlcw==');

  return { attemptRepository, contentRepository, evaluationResultRepository, objectStorageReader, attempt, contentVersion };
}

describe('processAttempt', () => {
  it('reads the real imported target words, calls inference, persists the result, and returns clean feedback', async () => {
    const { attemptRepository, contentRepository, evaluationResultRepository, objectStorageReader, attempt, contentVersion } =
      await setUp();

    const inferenceClient = new FakeInferenceClient({
      attempt_id: attempt.id,
      model_bundle_version: 'test-model-1',
      status: 'completed',
      audio_quality: { passed: true, duration_seconds: 3, silence_ratio: 0.1, clipped_sample_ratio: 0, estimated_snr_db: 20, failure_reasons: [] },
      word_segments: [{ word_index: 0, start_ms: 0, end_ms: 400 }],
      issue_candidates: [],
    });

    const feedback = await processAttempt(
      {
        attemptId: attempt.id,
        contentVersionId: contentVersion.id,
        surahNumber: 1,
        ayahStart: 1,
        ayahEnd: 1,
        referenceAudioBaseUrl: 'https://example.com/audio.wav',
        profileAgeClass: 'adult',
      },
      { attemptRepository, contentRepository, evaluationResultRepository, inferenceClient, objectStorageReader },
    );

    expect(feedback.evaluationStatus).toBe('completed');
    expect(feedback.confidenceTier).toBe('high');
    expect(feedback.modelBundleVersion).toBe('test-model-1');

    const persisted = await evaluationResultRepository.findLatestForAttempt(attempt.id);
    expect(persisted?.modelBundleVersion).toBe('test-model-1');

    const updatedAttempt = await attemptRepository.findById(attempt.id);
    expect(updatedAttempt?.status).toBe('completed');
  });

  it('propagates a needs_rerecord result from inference through to the attempt status and feedback', async () => {
    const { attemptRepository, contentRepository, evaluationResultRepository, objectStorageReader, attempt, contentVersion } =
      await setUp();

    const inferenceClient = new FakeInferenceClient({
      attempt_id: attempt.id,
      model_bundle_version: 'test-model-1',
      status: 'needs_rerecord',
      audio_quality: { passed: false, duration_seconds: 0.1, silence_ratio: 1, clipped_sample_ratio: 0, estimated_snr_db: 0, failure_reasons: ['too_short'] },
      word_segments: [],
      issue_candidates: [],
    });

    const feedback = await processAttempt(
      {
        attemptId: attempt.id,
        contentVersionId: contentVersion.id,
        surahNumber: 1,
        ayahStart: 1,
        ayahEnd: 1,
        referenceAudioBaseUrl: 'https://example.com/audio.wav',
        profileAgeClass: 'adult',
      },
      { attemptRepository, contentRepository, evaluationResultRepository, inferenceClient, objectStorageReader },
    );

    expect(feedback.evaluationStatus).toBe('needs_rerecord');
    expect(feedback.retryRecommendation).toBe('required');
    const updatedAttempt = await attemptRepository.findById(attempt.id);
    expect(updatedAttempt?.status).toBe('needs_rerecord');
  });
});
