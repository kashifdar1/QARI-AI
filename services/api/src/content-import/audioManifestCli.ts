import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseApiEnv } from '@qari/config';
import { createDb } from '../db/client.js';
import { buildAudioManifest } from './audioManifest.js';
import { DrizzleContentRepository } from './drizzleContentRepository.js';
import { DrizzleReciterAudioRepository } from './drizzleReciterAudioRepository.js';

const CONTENT_IMPORT_ROOT = fileURLToPath(new URL('../../../../content-import/', import.meta.url));

/**
 * Checks local placeholder-audio files rather than a real object-storage
 * bucket — there is no MinIO/S3 instance running in this development
 * environment (infrastructure/docker/docker-compose.yml defines one, but
 * Docker itself isn't available here). Swapping `objectExists` for a real
 * HEAD-object check against OBJECT_STORAGE_ENDPOINT is a Milestone C+
 * production concern using the same buildAudioManifest function.
 */
async function objectExistsLocally(objectKey: string): Promise<boolean> {
  try {
    await access(`${CONTENT_IMPORT_ROOT}${objectKey}`);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const env = parseApiEnv(process.env);
  const db = createDb(env.DATABASE_URL);
  const contentRepo = new DrizzleContentRepository(db);
  const reciterAudioRepo = new DrizzleReciterAudioRepository(db);

  const version = await contentRepo.findApprovedContentVersion();
  if (!version) {
    throw new Error('No approved content version found — run content:import and content:approve first');
  }
  const passages = await contentRepo.listPassages(version.id);
  const reciterAudio = await reciterAudioRepo.listByPassageIds(passages.map((p) => p.id));

  const report = await buildAudioManifest(passages, reciterAudio, objectExistsLocally);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
