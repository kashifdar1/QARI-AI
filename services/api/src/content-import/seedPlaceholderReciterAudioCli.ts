import { parseApiEnv } from '@qari/config';
import { createDb } from '../db/client.js';
import { DrizzleContentRepository } from './drizzleContentRepository.js';
import { DrizzleReciterAudioRepository } from './drizzleReciterAudioRepository.js';
import { seedPlaceholderReciterAudio } from './seedPlaceholderReciterAudio.js';

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
  const existing = await reciterAudioRepo.listByPassageIds(passages.map((p) => p.id));
  const seededPassageIds = new Set(existing.map((row) => row.passageId));
  const remaining = passages.filter((p) => !seededPassageIds.has(p.id));

  const created = remaining.length > 0 ? await seedPlaceholderReciterAudio(reciterAudioRepo, contentRepo, remaining) : [];

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ createdCount: created.length, alreadySeeded: existing.length }, null, 2));
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
