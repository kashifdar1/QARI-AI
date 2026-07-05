import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { InMemoryAttemptRepository } from './attemptRepository.js';
import { InMemoryEvaluationResultRepository } from './evaluationResultRepository.js';

const JWT_SECRET = 'test-secret-at-least-16-chars';

async function setUp() {
  const attemptRepository = new InMemoryAttemptRepository();
  const evaluationResultRepository = new InMemoryEvaluationResultRepository();
  const app = buildApp({ jwtSecret: JWT_SECRET, attemptRepository, evaluationResultRepository });

  const ownerSignup = await app.inject({
    method: 'POST',
    url: '/v1/auth/signup',
    payload: { email: 'owner2@example.com', password: 'hunter2hunter2' },
  });
  const { accessToken: ownerToken, userId: ownerUserId } = ownerSignup.json();
  const otherSignup = await app.inject({
    method: 'POST',
    url: '/v1/auth/signup',
    payload: { email: 'other2@example.com', password: 'hunter2hunter2' },
  });
  const { accessToken: otherToken } = otherSignup.json();

  attemptRepository.seedSession('session-1', 'profile-1', ownerUserId);
  const { attempt } = await attemptRepository.createAttemptIdempotent('session-1', randomUUID());

  return { app, attemptRepository, evaluationResultRepository, ownerToken, otherToken, attempt };
}

describe('GET /v1/attempts/:attemptId/evaluation', () => {
  it('reports the attempt status even before a result exists', async () => {
    const { app, ownerToken, attempt } = await setUp();
    const response = await app.inject({
      method: 'GET',
      url: `/v1/attempts/${attempt.id}/evaluation`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ attemptId: attempt.id, status: 'ready' });
  });

  it('another user cannot poll this attempt evaluation status', async () => {
    const { app, otherToken, attempt } = await setUp();
    const response = await app.inject({
      method: 'GET',
      url: `/v1/attempts/${attempt.id}/evaluation`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe('GET /v1/attempts/:attemptId/feedback', () => {
  it('returns 404 until an evaluation result has been persisted', async () => {
    const { app, ownerToken, attempt } = await setUp();
    const response = await app.inject({
      method: 'GET',
      url: `/v1/attempts/${attempt.id}/feedback`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns a real buildFeedback-shaped object once a result exists', async () => {
    const { app, ownerToken, evaluationResultRepository, attempt } = await setUp();
    await evaluationResultRepository.insert({
      attemptId: attempt.id,
      modelBundleVersion: 'model-1',
      contentVersionId: 'content-version-1',
      status: 'completed',
      audioQualityFailureReasons: [],
      audioQualityDurationSeconds: 5,
      wordSegments: [],
      issueCandidates: [],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/v1/attempts/${attempt.id}/feedback`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.evaluationStatus).toBe('completed');
    expect(body.confidenceTier).toBe('high');
    expect(body.teacherReviewAvailable).toBe(false);
  });
});

describe('POST /v1/attempts/:attemptId/report', () => {
  it('records a report against the latest evaluation result', async () => {
    const { app, ownerToken, evaluationResultRepository, attempt } = await setUp();
    await evaluationResultRepository.insert({
      attemptId: attempt.id,
      modelBundleVersion: 'model-1',
      contentVersionId: 'content-version-1',
      status: 'completed',
      audioQualityFailureReasons: [],
      audioQualityDurationSeconds: 5,
      wordSegments: [],
      issueCandidates: [],
    });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/attempts/${attempt.id}/report`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { reason: 'This flagged a word that was actually correct' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().reason).toContain('actually correct');
  });

  it('another user cannot report on this attempt', async () => {
    const { app, otherToken, attempt } = await setUp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/attempts/${attempt.id}/report`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { reason: 'trying to report someone else\'s attempt' },
    });
    expect(response.statusCode).toBe(403);
  });
});
