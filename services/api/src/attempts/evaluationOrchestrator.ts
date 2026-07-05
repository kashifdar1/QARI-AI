import { buildFeedback, type FeedbackResult, type ProfileAgeClass } from '@qari/domain';
import type { AttemptRepository } from './attemptRepository.js';
import type { ContentRepository } from '../content-import/contentRepository.js';
import type { EvaluationResultRepository } from './evaluationResultRepository.js';
import type { InferenceClient } from './inferenceClient.js';
import type { ObjectStorageReader } from './objectStorageReader.js';

export type ProcessAttemptDeps = {
  attemptRepository: AttemptRepository;
  contentRepository: ContentRepository;
  evaluationResultRepository: EvaluationResultRepository;
  inferenceClient: InferenceClient;
  objectStorageReader: ObjectStorageReader;
};

export type ProcessAttemptInput = {
  attemptId: string;
  contentVersionId: string;
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
  referenceAudioBaseUrl: string;
  profileAgeClass: ProfileAgeClass;
};

/**
 * The evaluation-job consumer's core logic (Milestone C task 3): reads the
 * uploaded audio, fetches the KNOWN target words from the imported content
 * (Milestone B), calls the REAL inference service (no stub), persists the
 * raw result, and runs it through packages/domain's buildFeedback — the
 * only place raw model output becomes a user-facing feedback object.
 *
 * This is normally invoked by a BullMQ worker process consuming the
 * `evaluation` queue; it's exposed here as a directly callable function so
 * it can be exercised in the golden-corpus integration test without a
 * separate worker process/Redis (which isn't available in this
 * environment — see the milestone risk notes).
 */
export async function processAttempt(
  input: ProcessAttemptInput,
  deps: ProcessAttemptDeps,
): Promise<FeedbackResult> {
  const { attemptRepository, contentRepository, evaluationResultRepository, inferenceClient, objectStorageReader } =
    deps;

  const attempt = await attemptRepository.findById(input.attemptId);
  if (!attempt || !attempt.objectKey) {
    throw new Error(`Attempt ${input.attemptId} has no uploaded object to evaluate`);
  }

  const targetWords: string[] = [];
  for (let ayah = input.ayahStart; ayah <= input.ayahEnd; ayah++) {
    const words = await contentRepository.getAyahWords(input.contentVersionId, input.surahNumber, ayah);
    targetWords.push(...words.map((w) => w.displayText));
  }

  const audioBase64 = await objectStorageReader.readObjectBase64(attempt.objectKey);
  const inferenceResult = await inferenceClient.evaluate(input.attemptId, targetWords, audioBase64);

  const evaluationStatus = inferenceResult.status;
  await evaluationResultRepository.insert({
    attemptId: input.attemptId,
    modelBundleVersion: inferenceResult.model_bundle_version,
    contentVersionId: input.contentVersionId,
    status: evaluationStatus,
    audioQualityFailureReasons: inferenceResult.audio_quality.failure_reasons,
    audioQualityDurationSeconds: inferenceResult.audio_quality.duration_seconds,
    wordSegments: inferenceResult.word_segments.map((w) => ({
      wordIndex: w.word_index,
      startMs: w.start_ms,
      endMs: w.end_ms,
    })),
    issueCandidates: inferenceResult.issue_candidates.map((c) => ({
      wordIndex: c.word_index,
      kind: c.kind as 'omission' | 'repetition' | 'substitution',
      modelConfidence: c.model_confidence,
    })),
  });

  await attemptRepository.updateStatus(input.attemptId, evaluationStatus);

  return buildFeedback({
    evaluationStatus,
    passageVersion: input.contentVersionId,
    modelBundleVersion: inferenceResult.model_bundle_version,
    audioQuality: {
      passed: inferenceResult.audio_quality.passed,
      durationSeconds: inferenceResult.audio_quality.duration_seconds,
      failureReasons: inferenceResult.audio_quality.failure_reasons,
    },
    wordSegments: inferenceResult.word_segments.map((w) => ({
      wordIndex: w.word_index,
      startMs: w.start_ms,
      endMs: w.end_ms,
    })),
    rawIssueCandidates: inferenceResult.issue_candidates.map((c) => ({
      wordIndex: c.word_index,
      kind: c.kind as 'omission' | 'repetition' | 'substitution',
      modelConfidence: c.model_confidence,
    })),
    profileAgeClass: input.profileAgeClass,
    referenceAudioBaseUrl: input.referenceAudioBaseUrl,
  });
}
