import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { InMemoryContentRepository } from '../content-import/contentRepository.js';
import { InMemoryProfileRepository } from './profileRepository.js';
import { InMemorySessionRepository } from './sessionRepository.js';

const JWT_SECRET = 'test-secret-at-least-16-chars';

async function setUp() {
  const contentRepository = new InMemoryContentRepository();
  const profileRepository = new InMemoryProfileRepository();
  const sessionRepository = new InMemorySessionRepository();
  const app = buildApp({ jwtSecret: JWT_SECRET, contentRepository, profileRepository, sessionRepository });

  const version = await contentRepository.insertContentVersion({
    riwayah: 'hafs_an_asim',
    source: 'tanzil_net_uthmani',
    sourceChecksum: 'checksum',
  });
  const passage = await contentRepository.insertPassage({
    contentVersionId: version.id,
    surahNumber: 1,
    ayahStart: 1,
    ayahEnd: 7,
    riwayah: 'hafs_an_asim',
  });

  const ownerSignup = await app.inject({
    method: 'POST',
    url: '/v1/auth/signup',
    payload: { email: 'owner@example.com', password: 'hunter2hunter2' },
  });
  const { accessToken: ownerToken } = ownerSignup.json();

  const otherSignup = await app.inject({
    method: 'POST',
    url: '/v1/auth/signup',
    payload: { email: 'other@example.com', password: 'hunter2hunter2' },
  });
  const { accessToken: otherToken } = otherSignup.json();

  return { app, passage, ownerToken, otherToken };
}

describe('POST /v1/profiles', () => {
  it('creates a profile owned by the caller', async () => {
    const { app, ownerToken } = await setUp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/profiles',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { displayName: 'Kashif', profileType: 'adult' },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.displayName).toBe('Kashif');
    expect(body.profileType).toBe('adult');
  });

  it('requires auth', async () => {
    const { app } = await setUp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/profiles',
      payload: { displayName: 'Kashif', profileType: 'adult' },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('POST /v1/sessions', () => {
  it('creates a session for the caller\'s own profile and an existing passage', async () => {
    const { app, passage, ownerToken } = await setUp();
    const profileResponse = await app.inject({
      method: 'POST',
      url: '/v1/profiles',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { displayName: 'Kashif', profileType: 'adult' },
    });
    const profile = profileResponse.json();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { profileId: profile.id, passageId: passage.id },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.profileId).toBe(profile.id);
    expect(body.passageId).toBe(passage.id);
  });

  it('another user cannot create a session against someone else\'s profile', async () => {
    const { app, passage, ownerToken, otherToken } = await setUp();
    const profileResponse = await app.inject({
      method: 'POST',
      url: '/v1/profiles',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { displayName: 'Kashif', profileType: 'adult' },
    });
    const profile = profileResponse.json();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { profileId: profile.id, passageId: passage.id },
    });
    expect(response.statusCode).toBe(403);
  });

  it('404s for a passage that does not exist', async () => {
    const { app, ownerToken } = await setUp();
    const profileResponse = await app.inject({
      method: 'POST',
      url: '/v1/profiles',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { displayName: 'Kashif', profileType: 'adult' },
    });
    const profile = profileResponse.json();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { profileId: profile.id, passageId: 'nonexistent' },
    });
    expect(response.statusCode).toBe(404);
  });
});
