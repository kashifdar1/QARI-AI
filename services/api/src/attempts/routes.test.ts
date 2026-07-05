import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { InMemoryAttemptRepository } from './attemptRepository.js';
import { FakeObjectStorage } from './objectStorage.js';
import { InMemoryEvaluationQueue } from './evaluationQueue.js';

const JWT_SECRET = 'test-secret-at-least-16-chars';

async function setUp() {
  const attemptRepository = new InMemoryAttemptRepository();
  const evaluationQueue = new InMemoryEvaluationQueue();
  const objectStorage = new FakeObjectStorage();
  const app = buildApp({ jwtSecret: JWT_SECRET, attemptRepository, evaluationQueue, objectStorage });

  const ownerSignup = await app.inject({
    method: 'POST',
    url: '/v1/auth/signup',
    payload: { email: 'owner@example.com', password: 'hunter2hunter2' },
  });
  const { accessToken: ownerToken, userId: ownerUserId } = ownerSignup.json();

  const otherSignup = await app.inject({
    method: 'POST',
    url: '/v1/auth/signup',
    payload: { email: 'other@example.com', password: 'hunter2hunter2' },
  });
  const { accessToken: otherToken } = otherSignup.json();

  const sessionId = 'session-1';
  attemptRepository.seedSession(sessionId, 'profile-1', ownerUserId);

  return { app, attemptRepository, evaluationQueue, objectStorage, ownerToken, otherToken, sessionId };
}

describe('POST /v1/sessions/:sessionId/attempts — idempotency', () => {
  it('a duplicate request with the same clientAttemptId returns the SAME attempt, not a new one', async () => {
    const { app, ownerToken, sessionId } = await setUp();
    const clientAttemptId = randomUUID();
    const idempotencyKey = randomUUID();

    const first = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/attempts`,
      headers: { authorization: `Bearer ${ownerToken}`, 'idempotency-key': idempotencyKey },
      payload: { clientAttemptId },
    });
    expect(first.statusCode).toBe(201);
    const firstBody = first.json();

    const second = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/attempts`,
      headers: { authorization: `Bearer ${ownerToken}`, 'idempotency-key': idempotencyKey },
      payload: { clientAttemptId },
    });
    expect(second.statusCode).toBe(200);
    const secondBody = second.json();

    expect(secondBody.id).toBe(firstBody.id);
  });

  it('a different clientAttemptId creates a genuinely different attempt', async () => {
    const { app, ownerToken, sessionId } = await setUp();
    const first = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/attempts`,
      headers: { authorization: `Bearer ${ownerToken}`, 'idempotency-key': randomUUID() },
      payload: { clientAttemptId: randomUUID() },
    });
    const second = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/attempts`,
      headers: { authorization: `Bearer ${ownerToken}`, 'idempotency-key': randomUUID() },
      payload: { clientAttemptId: randomUUID() },
    });
    expect(first.json().id).not.toBe(second.json().id);
  });

  it('requires the Idempotency-Key header', async () => {
    const { app, ownerToken, sessionId } = await setUp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/attempts`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { clientAttemptId: randomUUID() },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('attempt lifecycle — authorization (CLAUDE.md §5)', () => {
  it('another user cannot create an attempt in a session they do not own', async () => {
    const { app, otherToken, sessionId } = await setUp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/attempts`,
      headers: { authorization: `Bearer ${otherToken}`, 'idempotency-key': randomUUID() },
      payload: { clientAttemptId: randomUUID() },
    });
    expect(response.statusCode).toBe(403);
  });

  it('another user cannot read this attempt', async () => {
    const { app, ownerToken, otherToken, sessionId } = await setUp();
    const created = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/attempts`,
      headers: { authorization: `Bearer ${ownerToken}`, 'idempotency-key': randomUUID() },
      payload: { clientAttemptId: randomUUID() },
    });
    const attemptId = created.json().id;

    const ownerRead = await app.inject({
      method: 'GET',
      url: `/v1/attempts/${attemptId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(ownerRead.statusCode).toBe(200);

    const otherRead = await app.inject({
      method: 'GET',
      url: `/v1/attempts/${attemptId}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(otherRead.statusCode).toBe(403);
  });

  it('another user cannot request an upload URL or complete this attempt', async () => {
    const { app, ownerToken, otherToken, sessionId } = await setUp();
    const created = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/attempts`,
      headers: { authorization: `Bearer ${ownerToken}`, 'idempotency-key': randomUUID() },
      payload: { clientAttemptId: randomUUID() },
    });
    const attemptId = created.json().id;

    const uploadUrlAsOther = await app.inject({
      method: 'POST',
      url: `/v1/attempts/${attemptId}/upload-url`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { contentType: 'audio/wav', sizeBytes: 1000 },
    });
    expect(uploadUrlAsOther.statusCode).toBe(403);

    const completeAsOther = await app.inject({
      method: 'POST',
      url: `/v1/attempts/${attemptId}/complete`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(completeAsOther.statusCode).toBe(403);
  });

  it('returns 404 (not 403) for a nonexistent attempt id, avoiding existence-leak on top of authz', async () => {
    const { app, ownerToken } = await setUp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/attempts/does-not-exist',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('POST /v1/attempts/:attemptId/complete', () => {
  it('rejects completion when the uploaded object does not exist in storage', async () => {
    const { app, ownerToken, sessionId } = await setUp();
    const created = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/attempts`,
      headers: { authorization: `Bearer ${ownerToken}`, 'idempotency-key': randomUUID() },
      payload: { clientAttemptId: randomUUID() },
    });
    const attemptId = created.json().id;

    await app.inject({
      method: 'POST',
      url: `/v1/attempts/${attemptId}/upload-url`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { contentType: 'audio/wav', sizeBytes: 1000 },
    });
    // Object was never actually "uploaded" to the fake storage.
    const complete = await app.inject({
      method: 'POST',
      url: `/v1/attempts/${attemptId}/complete`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(complete.statusCode).toBe(400);
  });

  it('accepts completion, moves status to queued, and enqueues an evaluation job when the object exists', async () => {
    const { app, ownerToken, sessionId, objectStorage, evaluationQueue } = await setUp();
    const created = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/attempts`,
      headers: { authorization: `Bearer ${ownerToken}`, 'idempotency-key': randomUUID() },
      payload: { clientAttemptId: randomUUID() },
    });
    const attemptId = created.json().id;

    const uploadUrlResponse = await app.inject({
      method: 'POST',
      url: `/v1/attempts/${attemptId}/upload-url`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { contentType: 'audio/wav', sizeBytes: 1000 },
    });
    objectStorage.markExists(uploadUrlResponse.json().objectKey);

    const complete = await app.inject({
      method: 'POST',
      url: `/v1/attempts/${attemptId}/complete`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(complete.statusCode).toBe(202);
    expect(complete.json().status).toBe('queued');
    expect(evaluationQueue.enqueued).toContain(attemptId);
  });
});
