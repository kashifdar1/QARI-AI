import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parseApiEnv } from '@qari/config';
import { createDb } from '../db/client.js';
import { approveContentVersion } from './approveCommand.js';
import { DrizzleContentRepository } from './drizzleContentRepository.js';
import { importTanzilContent } from './importCommand.js';

const DEFAULT_METADATA_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-quran-metadata-v1.0.xml', import.meta.url),
);

async function runImport(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      source: { type: 'string' },
      file: { type: 'string' },
      metadata: { type: 'string', default: DEFAULT_METADATA_PATH },
    },
  });

  if (values.source !== 'tanzil') {
    throw new Error(`Unsupported --source "${values.source}". Only "tanzil" is implemented.`);
  }
  if (!values.file) {
    throw new Error('--file <path> is required');
  }

  const env = parseApiEnv(process.env);
  const db = createDb(env.DATABASE_URL);
  const repo = new DrizzleContentRepository(db);

  const result = await importTanzilContent(repo, values.file, values.metadata!);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        contentVersionId: result.contentVersion.id,
        reviewStatus: result.contentVersion.reviewStatus,
        riwayah: result.contentVersion.riwayah,
        ayahCount: result.ayahCount,
        wordCount: result.wordCount,
        sha256: result.sha256,
      },
      null,
      2,
    ),
  );
}

async function runApprove(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      version: { type: 'string' },
      reviewer: { type: 'string' },
    },
  });

  if (!values.version) throw new Error('--version <id> is required');
  if (!values.reviewer) throw new Error('--reviewer <name> is required');

  const env = parseApiEnv(process.env);
  const db = createDb(env.DATABASE_URL);
  const repo = new DrizzleContentRepository(db);

  const result = await approveContentVersion(repo, values.version, values.reviewer);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        contentVersionId: result.id,
        reviewStatus: result.reviewStatus,
        reviewedBy: result.reviewedBy,
        reviewedAt: result.reviewedAt,
      },
      null,
      2,
    ),
  );
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'import') {
    await runImport(rest);
  } else if (command === 'approve') {
    await runApprove(rest);
  } else {
    throw new Error(`Unknown command "${command}". Expected "import" or "approve".`);
  }
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
