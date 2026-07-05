import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { approveContentVersion } from '../content-import/approveCommand.js';
import { InMemoryContentRepository } from '../content-import/contentRepository.js';
import { importTanzilContent } from '../content-import/importCommand.js';
import { MVP_SURAH_NUMBERS, seedMvpPassages } from '../content-import/mvpPassageSeed.js';
import { InMemoryReciterAudioRepository } from '../content-import/reciterAudioRepository.js';
import { seedPlaceholderReciterAudio } from '../content-import/seedPlaceholderReciterAudio.js';

const JWT_SECRET = 'test-secret-at-least-16-chars';
const TEXT_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-uthmani-v1.1.txt', import.meta.url),
);
const METADATA_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-quran-metadata-v1.0.xml', import.meta.url),
);

async function buildAppWithApprovedContent() {
  const contentRepository = new InMemoryContentRepository();
  const reciterAudioRepository = new InMemoryReciterAudioRepository();

  const { contentVersion } = await importTanzilContent(contentRepository, TEXT_PATH, METADATA_PATH);
  await approveContentVersion(contentRepository, contentVersion.id, 'Test Reviewer');
  const passages = await seedMvpPassages(contentRepository, contentVersion.id, METADATA_PATH);
  await seedPlaceholderReciterAudio(reciterAudioRepository, contentRepository, passages);

  const app = buildApp({ jwtSecret: JWT_SECRET, contentRepository, reciterAudioRepository });
  return { app, passages };
}

describe('GET /v1/content/passages', () => {
  it('returns all 23 MVP passages with NO Authorization header (public-read)', async () => {
    const { app } = await buildAppWithApprovedContent();
    const response = await app.inject({ method: 'GET', url: '/v1/content/passages' });
    expect(response.statusCode).toBe(200);
    expect(response.json().items).toHaveLength(MVP_SURAH_NUMBERS.length);
  });

  it('filters by surahNumber', async () => {
    const { app } = await buildAppWithApprovedContent();
    const response = await app.inject({ method: 'GET', url: '/v1/content/passages?surahNumber=1' });
    expect(response.statusCode).toBe(200);
    const items = response.json().items;
    expect(items).toHaveLength(1);
    expect(items[0].surahNumber).toBe(1);
    expect(items[0].riwayah).toBe('hafs_an_asim');
  });

  it('returns 400 for an out-of-range surahNumber', async () => {
    const { app } = await buildAppWithApprovedContent();
    const response = await app.inject({ method: 'GET', url: '/v1/content/passages?surahNumber=200' });
    expect(response.statusCode).toBe(400);
  });

  it('sets an ETag and returns 304 when If-None-Match matches on a second request', async () => {
    const { app } = await buildAppWithApprovedContent();
    const first = await app.inject({ method: 'GET', url: '/v1/content/passages' });
    const etag = first.headers.etag as string;
    expect(etag).toBeTruthy();

    const second = await app.inject({
      method: 'GET',
      url: '/v1/content/passages',
      headers: { 'if-none-match': etag },
    });
    expect(second.statusCode).toBe(304);
  });

  it('returns 404 when no content version has been approved yet', async () => {
    const contentRepository = new InMemoryContentRepository();
    const reciterAudioRepository = new InMemoryReciterAudioRepository();
    // Import but do NOT approve.
    await importTanzilContent(contentRepository, TEXT_PATH, METADATA_PATH);
    const app = buildApp({ jwtSecret: JWT_SECRET, contentRepository, reciterAudioRepository });

    const response = await app.inject({ method: 'GET', url: '/v1/content/passages' });
    expect(response.statusCode).toBe(404);
  });
});

describe('GET /v1/content/passages/:passageId', () => {
  it('returns Arabic word data, riwayah label, and a stubbed-unavailable translation toggle, with no Authorization header', async () => {
    const { app, passages } = await buildAppWithApprovedContent();
    const fatiha = passages.find((p) => p.surahNumber === 1)!;

    const response = await app.inject({ method: 'GET', url: `/v1/content/passages/${fatiha.id}` });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.riwayah).toBe('hafs_an_asim');
    expect(body.ayahs).toHaveLength(7); // Al-Fatihah has 7 ayat
    expect(body.ayahs[0].words.length).toBeGreaterThan(0);
    expect(body.translation).toEqual({ available: false, reason: 'no_cleared_translation_license' });
    expect(body.referenceAudioUrl).toContain('PLACEHOLDER_AUDIO_surah-001.wav');
  });

  it('returns 404 for an unknown passage id', async () => {
    const { app } = await buildAppWithApprovedContent();
    const response = await app.inject({ method: 'GET', url: '/v1/content/passages/does-not-exist' });
    expect(response.statusCode).toBe(404);
  });
});

describe('content routes vs. authenticated routes — no auth bypass', () => {
  it('content routes work with zero Authorization header, but auth-required routes still reject the same request shape', async () => {
    const { app } = await buildAppWithApprovedContent();

    const contentResponse = await app.inject({ method: 'GET', url: '/v1/content/passages' });
    expect(contentResponse.statusCode).toBe(200);

    const guestUpgradeResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/guest-upgrade',
      payload: { email: 'x@example.com', password: 'hunter2hunter2' },
    });
    expect(guestUpgradeResponse.statusCode).toBe(401);
  });
});

describe('rate limiting on the public content surface', () => {
  it('eventually returns 429 after exceeding the configured request rate', async () => {
    const { app } = await buildAppWithApprovedContent();
    let lastStatus = 200;
    for (let i = 0; i < 105; i++) {
      const response = await app.inject({ method: 'GET', url: '/v1/content/passages' });
      lastStatus = response.statusCode;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });
});
