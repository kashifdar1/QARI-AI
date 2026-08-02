import { parseApiEnv } from '@qari/config';
import { buildApp } from './app.js';
import { DrizzleUserRepository } from './auth/drizzleUserRepository.js';
import { DrizzleAttemptRepository } from './attempts/drizzleAttemptRepository.js';
import { BullMqEvaluationQueue } from './attempts/bullmqEvaluationQueue.js';
import { DrizzleEvaluationResultRepository } from './attempts/drizzleEvaluationResultRepository.js';
import { DrizzleReportRepository } from './attempts/drizzleReportRepository.js';
import { S3ObjectStorage } from './attempts/objectStorage.js';
import { DrizzleContentRepository } from './content-import/drizzleContentRepository.js';
import { DrizzleReciterAudioRepository } from './content-import/drizzleReciterAudioRepository.js';
import { createDb } from './db/client.js';
import { DrizzleProfileRepository } from './sessions/drizzleProfileRepository.js';
import { DrizzleSessionRepository } from './sessions/drizzleSessionRepository.js';

const env = parseApiEnv(process.env);
const db = createDb(env.DATABASE_URL);
const publicObjectEndpoint = env.OBJECT_STORAGE_PUBLIC_ENDPOINT ?? env.OBJECT_STORAGE_ENDPOINT;
const objectStorageConfig = {
  endpoint: env.OBJECT_STORAGE_ENDPOINT,
  publicEndpoint: publicObjectEndpoint,
  bucket: env.OBJECT_STORAGE_BUCKET,
  accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID,
  secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
};
const app = buildApp({
  jwtSecret: env.JWT_SECRET,
  userRepository: new DrizzleUserRepository(db),
  contentRepository: new DrizzleContentRepository(db),
  reciterAudioRepository: new DrizzleReciterAudioRepository(db),
  attemptRepository: new DrizzleAttemptRepository(db),
  evaluationQueue: new BullMqEvaluationQueue(env.REDIS_URL),
  objectStorage: new S3ObjectStorage(objectStorageConfig),
  profileRepository: new DrizzleProfileRepository(db),
  sessionRepository: new DrizzleSessionRepository(db),
  evaluationResultRepository: new DrizzleEvaluationResultRepository(db),
  reportRepository: new DrizzleReportRepository(db),
  publicObjectBaseUrl: `${publicObjectEndpoint}/${env.OBJECT_STORAGE_BUCKET}`,
  signedUrlTtlSeconds: env.SIGNED_URL_TTL_SECONDS,
});

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(`api listening on :${env.PORT}`);
  })
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
