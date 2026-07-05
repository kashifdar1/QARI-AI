import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parseApiEnv } from '@qari/config';
import { createDb } from '../db/client.js';
import { DrizzleContentRepository } from './drizzleContentRepository.js';
import { seedMvpPassages } from './mvpPassageSeed.js';

const DEFAULT_METADATA_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-quran-metadata-v1.0.xml', import.meta.url),
);

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      version: { type: 'string' },
      metadata: { type: 'string', default: DEFAULT_METADATA_PATH },
    },
  });
  if (!values.version) throw new Error('--version <approved content version id> is required');

  const env = parseApiEnv(process.env);
  const db = createDb(env.DATABASE_URL);
  const repo = new DrizzleContentRepository(db);

  const version = await repo.findContentVersion(values.version);
  if (!version) throw new Error(`No content version with id ${values.version}`);
  if (version.reviewStatus !== 'approved') {
    throw new Error(
      `Content version ${values.version} is "${version.reviewStatus}", not "approved" — passages must reference an approved version`,
    );
  }

  const passages = await seedMvpPassages(repo, values.version, values.metadata!);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ createdCount: passages.length, surahNumbers: passages.map((p) => p.surahNumber) }, null, 2));
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
