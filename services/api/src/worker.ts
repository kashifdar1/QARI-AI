import { parseApiEnv } from '@qari/config';
import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { EVALUATION_QUEUE_NAME, type EvaluationJobData } from './attempts/bullmqEvaluationQueue.js';
import { DrizzleAttemptRepository } from './attempts/drizzleAttemptRepository.js';
import { DrizzleEvaluationResultRepository } from './attempts/drizzleEvaluationResultRepository.js';
import { processAttempt } from './attempts/evaluationOrchestrator.js';
import { HttpInferenceClient } from './attempts/inferenceClient.js';
import { S3ObjectStorageReader } from './attempts/objectStorageReader.js';
import { DrizzleContentRepository } from './content-import/drizzleContentRepository.js';
import { createDb } from './db/client.js';
import { DrizzleProfileRepository } from './sessions/drizzleProfileRepository.js';
import { DrizzleSessionRepository } from './sessions/drizzleSessionRepository.js';

/**
 * The evaluation-job consumer (Milestone C task 3): dequeues attempts from
 * the `evaluation` BullMQ queue and runs them through the real
 * inference/forced-alignment/feedback pipeline
 * (attempts/evaluationOrchestrator.ts's processAttempt). This file did not
 * exist before — processAttempt was only ever called from its own unit
 * test and the manual golden-corpus script, so no queued job was ever
 * actually processed outside of tests. Run as a separate process from the
 * API server (`pnpm worker`), same as any BullMQ consumer.
 */
const env = parseApiEnv(process.env);
const db = createDb(env.DATABASE_URL);
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

const attemptRepository = new DrizzleAttemptRepository(db);
const contentRepository = new DrizzleContentRepository(db);
const evaluationResultRepository = new DrizzleEvaluationResultRepository(db);
const sessionRepository = new DrizzleSessionRepository(db);
const profileRepository = new DrizzleProfileRepository(db);
const inferenceClient = new HttpInferenceClient(env.INFERENCE_SERVICE_URL);
const objectStorageReader = new S3ObjectStorageReader({
  endpoint: env.OBJECT_STORAGE_ENDPOINT,
  bucket: env.OBJECT_STORAGE_BUCKET,
  accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID,
  secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
});
const publicObjectBaseUrl = `${env.OBJECT_STORAGE_PUBLIC_ENDPOINT ?? env.OBJECT_STORAGE_ENDPOINT}/${env.OBJECT_STORAGE_BUCKET}`;

async function handleJob(job: Job<EvaluationJobData>): Promise<void> {
  const { attemptId } = job.data;

  const ownership = await attemptRepository.findOwnershipForAttempt(attemptId);
  if (!ownership) throw new Error(`Attempt ${attemptId} has no session/profile to evaluate against`);

  const session = await sessionRepository.findById(ownership.sessionId);
  if (!session) throw new Error(`Attempt ${attemptId}'s session ${ownership.sessionId} was not found`);

  const profile = await profileRepository.findById(ownership.profileId);
  if (!profile) throw new Error(`Attempt ${attemptId}'s profile ${ownership.profileId} was not found`);

  const passage = await contentRepository.findPassage(session.passageId);
  if (!passage) throw new Error(`Session ${session.id}'s passage ${session.passageId} was not found`);

  await attemptRepository.updateStatus(attemptId, 'processing');

  try {
    await processAttempt(
      {
        attemptId,
        contentVersionId: passage.contentVersionId,
        surahNumber: passage.surahNumber,
        ayahStart: passage.ayahStart,
        ayahEnd: passage.ayahEnd,
        referenceAudioBaseUrl: publicObjectBaseUrl,
        profileAgeClass: profile.profileType,
      },
      { attemptRepository, contentRepository, evaluationResultRepository, inferenceClient, objectStorageReader },
    );
  } catch (err) {
    await attemptRepository.updateStatus(attemptId, 'failed');
    throw err;
  }
}

const worker = new Worker<EvaluationJobData>(EVALUATION_QUEUE_NAME, handleJob, { connection });

worker.on('completed', (job) => {
  // eslint-disable-next-line no-console
  console.log(`evaluation job ${job.id} (attempt ${job.data.attemptId}) completed`);
});

worker.on('failed', (job, err) => {
  // eslint-disable-next-line no-console
  console.error(`evaluation job ${job?.id} (attempt ${job?.data.attemptId}) failed:`, err);
});

// eslint-disable-next-line no-console
console.log(`evaluation worker listening on queue "${EVALUATION_QUEUE_NAME}"`);
