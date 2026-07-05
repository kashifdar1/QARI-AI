/* eslint-disable no-console */
/**
 * Golden-corpus integration test (Milestone C task 5): starts the REAL
 * services/inference FastAPI app (real Wav2Vec2ForCTC checkpoint, no
 * stub), runs every clip in test-data/golden-audio through the full
 * services/api evaluation orchestration (real HTTP call, real forced
 * alignment), and asserts the quality gate behaves correctly.
 *
 * Not run as part of `pnpm test` — it spawns a Python subprocess and
 * waits ~30-60s for the model to load, which is too slow for the regular
 * unit-test loop. Run directly:
 *
 *   npx tsx scripts/goldenCorpusIntegration.ts
 *
 * See test-data/golden-audio/README.md for why only non-recitation clips
 * exist (silence/noise/too-short/clipped) — the recitation-specific
 * assertions (omission/repetition/substitution detection, clean-clip
 * precision) are a documented human-owner blocker, not implemented here.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { InMemoryAttemptRepository } from '../src/attempts/attemptRepository.js';
import { processAttempt } from '../src/attempts/evaluationOrchestrator.js';
import { InMemoryEvaluationResultRepository } from '../src/attempts/evaluationResultRepository.js';
import { HttpInferenceClient } from '../src/attempts/inferenceClient.js';
import { FakeObjectStorageReader } from '../src/attempts/objectStorageReader.js';
import { InMemoryContentRepository } from '../src/content-import/contentRepository.js';
import { importTanzilContent } from '../src/content-import/importCommand.js';

const INFERENCE_DIR = fileURLToPath(new URL('../../inference', import.meta.url));
const INFERENCE_PORT = 8098;
const INFERENCE_URL = `http://127.0.0.1:${INFERENCE_PORT}`;

const TEXT_PATH = fileURLToPath(new URL('../../../content-import/sources/tanzil-uthmani-v1.1.txt', import.meta.url));
const METADATA_PATH = fileURLToPath(
  new URL('../../../content-import/sources/tanzil-quran-metadata-v1.0.xml', import.meta.url),
);
const GOLDEN_AUDIO_DIR = fileURLToPath(new URL('../../../test-data/golden-audio', import.meta.url));

function startInferenceService(): ChildProcess {
  return spawn(
    `${INFERENCE_DIR}/.venv/bin/uvicorn`,
    ['app.main:app', '--host', '127.0.0.1', '--port', String(INFERENCE_PORT)],
    { cwd: INFERENCE_DIR, stdio: 'inherit' },
  );
}

async function waitForHealth(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${INFERENCE_URL}/health`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Inference service did not become healthy within ${timeoutMs}ms`);
}

function wavFileToBase64(path: string): string {
  return readFileSync(path).toString('base64');
}

async function main(): Promise<void> {
  console.log('Starting real inference service (loading real ASR checkpoint)...');
  const proc = startInferenceService();
  let failed = false;

  try {
    await waitForHealth(120_000);
    console.log('Inference service is healthy.\n');

    const contentRepository = new InMemoryContentRepository();
    const { contentVersion } = await importTanzilContent(contentRepository, TEXT_PATH, METADATA_PATH);
    console.log(`Imported real Tanzil content: version ${contentVersion.id}\n`);

    const inferenceClient = new HttpInferenceClient(INFERENCE_URL);
    const attemptRepository = new InMemoryAttemptRepository();
    attemptRepository.seedSession('session-1', 'profile-1', 'user-1');

    const cases: Array<{ file: string; expectReason: string }> = [
      { file: 'silent.wav', expectReason: 'mostly_silent' },
      { file: 'white_noise.wav', expectReason: 'noisy' },
      { file: 'too_short_tone.wav', expectReason: 'too_short' },
      { file: 'clipped_tone.wav', expectReason: 'clipping' },
    ];

    for (const testCase of cases) {
      const evaluationResultRepository = new InMemoryEvaluationResultRepository();
      const objectStorageReader = new FakeObjectStorageReader();
      const { attempt } = await attemptRepository.createAttemptIdempotent('session-1', `client-${testCase.file}`);
      const objectKey = `attempts/${attempt.id}.wav`;
      await attemptRepository.updateStatus(attempt.id, 'queued', objectKey);
      objectStorageReader.seed(objectKey, wavFileToBase64(`${GOLDEN_AUDIO_DIR}/${testCase.file}`));

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

      const gotExpectedReason = feedback.audioQuality.failureReasons.some((r) => r.includes(testCase.expectReason));
      const status = feedback.evaluationStatus === 'needs_rerecord' && gotExpectedReason ? 'PASS' : 'FAIL';
      if (status === 'FAIL') failed = true;
      console.log(
        `[${status}] ${testCase.file}: status=${feedback.evaluationStatus}, reasons=${JSON.stringify(
          feedback.audioQuality.failureReasons,
        )}`,
      );
    }

    console.log(
      '\nNOTE: no recitation-specific clips (clean/omission/repetition/substitution) exist in the golden' +
        ' corpus yet — see test-data/golden-audio/README.md for why this is a documented human-owner blocker,' +
        ' not something this script fakes.',
    );
  } finally {
    proc.kill();
  }

  if (failed) {
    console.error('\nSome golden-corpus assertions FAILED.');
    process.exit(1);
  }
  console.log('\nAll golden-corpus quality-gate assertions PASSED (real inference service, no stub).');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
