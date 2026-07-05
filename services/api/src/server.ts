import { parseApiEnv } from '@qari/config';
import { buildApp } from './app.js';
import { DrizzleUserRepository } from './auth/drizzleUserRepository.js';
import { DrizzleContentRepository } from './content-import/drizzleContentRepository.js';
import { DrizzleReciterAudioRepository } from './content-import/drizzleReciterAudioRepository.js';
import { createDb } from './db/client.js';

const env = parseApiEnv(process.env);
const db = createDb(env.DATABASE_URL);
const app = buildApp({
  jwtSecret: env.JWT_SECRET,
  userRepository: new DrizzleUserRepository(db),
  contentRepository: new DrizzleContentRepository(db),
  reciterAudioRepository: new DrizzleReciterAudioRepository(db),
  publicObjectBaseUrl: `${env.OBJECT_STORAGE_ENDPOINT}/${env.OBJECT_STORAGE_BUCKET}`,
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
