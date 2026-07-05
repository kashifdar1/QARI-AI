import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MVP_SURAH_NUMBERS } from './mvpPassageSeed.js';
import { generateSilentWav, placeholderObjectKey } from './placeholderAudio.js';

const OUTPUT_ROOT = fileURLToPath(new URL('../../../../content-import/', import.meta.url));
const PLACEHOLDER_DURATION_SECONDS = 2;

/**
 * Writes real (silent) WAV files to content-import/placeholder-audio/, one
 * per MVP passage. This stands in for an object-storage upload — there is
 * no MinIO/S3 instance running in this development environment, so
 * `content:audio-manifest` checks these local files instead of a real
 * bucket (documented in the CLI's own output and in the milestone risk
 * notes).
 */
async function main(): Promise<void> {
  const written: string[] = [];
  for (const surahNumber of MVP_SURAH_NUMBERS) {
    const relativeKey = placeholderObjectKey(surahNumber);
    const fullPath = join(OUTPUT_ROOT, relativeKey);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, generateSilentWav(PLACEHOLDER_DURATION_SECONDS));
    written.push(relativeKey);
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ writtenCount: written.length, files: written }, null, 2));
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
