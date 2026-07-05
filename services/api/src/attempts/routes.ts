import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/requireAuth.js';
import { badRequest, notFound } from '../errors.js';
import { assertProfileAccess, requireAttemptAccess } from './attemptAccess.js';
import type { AttemptRepository } from './attemptRepository.js';
import type { EvaluationQueue } from './evaluationQueue.js';
import type { ObjectStorage } from './objectStorage.js';

const createAttemptBodySchema = z.object({
  clientAttemptId: z.string().uuid(),
});

const createUploadUrlBodySchema = z.object({
  contentType: z.literal('audio/wav'),
  sizeBytes: z.number().int().positive(),
});

export function registerAttemptRoutes(
  app: FastifyInstance,
  deps: {
    attemptRepository: AttemptRepository;
    evaluationQueue: EvaluationQueue;
    objectStorage: ObjectStorage;
    jwtSecret: string;
    signedUrlTtlSeconds: number;
  },
): void {
  const { attemptRepository, evaluationQueue, objectStorage, jwtSecret, signedUrlTtlSeconds } = deps;

  app.post<{ Params: { sessionId: string } }>('/v1/sessions/:sessionId/attempts', async (request, reply) => {
    const claims = requireAuth(request, jwtSecret);
    const { sessionId } = request.params;

    const ownership = await attemptRepository.findSessionOwnership(sessionId);
    if (!ownership) throw notFound(`No session with id ${sessionId}`);
    assertProfileAccess(claims.sub, { ownerUserId: ownership.ownerUserId });

    if (!request.headers['idempotency-key']) {
      throw badRequest('Idempotency-Key header is required');
    }
    const parsed = createAttemptBodySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest(parsed.error.message);

    const { attempt, created } = await attemptRepository.createAttemptIdempotent(
      sessionId,
      parsed.data.clientAttemptId,
    );
    reply.code(created ? 201 : 200);
    return attempt;
  });

  app.post<{ Params: { attemptId: string }; Body: unknown }>(
    '/v1/attempts/:attemptId/upload-url',
    async (request, reply) => {
      const { attemptId } = request.params;
      await requireAttemptAccess(request, attemptRepository, jwtSecret, attemptId);

      const parsed = createUploadUrlBodySchema.safeParse(request.body);
      if (!parsed.success) throw badRequest(parsed.error.message);

      const objectKey = `attempts/${attemptId}.wav`;
      const url = await objectStorage.createSignedUploadUrl(objectKey, signedUrlTtlSeconds);
      const expiresAt = new Date(Date.now() + signedUrlTtlSeconds * 1000).toISOString();

      await attemptRepository.updateStatus(attemptId, 'uploading', objectKey);
      reply.code(200);
      return { url, expiresAt, objectKey };
    },
  );

  app.post<{ Params: { attemptId: string } }>('/v1/attempts/:attemptId/complete', async (request, reply) => {
    const { attemptId } = request.params;
    await requireAttemptAccess(request, attemptRepository, jwtSecret, attemptId);

    const attempt = await attemptRepository.findById(attemptId);
    if (!attempt) throw notFound(`No attempt with id ${attemptId}`);
    if (!attempt.objectKey) {
      throw badRequest('Attempt has no uploaded object yet');
    }

    const exists = await objectStorage.objectExists(attempt.objectKey);
    if (!exists) {
      throw badRequest('Uploaded object was not found in storage');
    }

    const updated = await attemptRepository.updateStatus(attemptId, 'queued');
    await evaluationQueue.enqueue(attemptId);

    reply.code(202);
    return updated;
  });

  app.get<{ Params: { attemptId: string } }>('/v1/attempts/:attemptId', async (request) => {
    const { attemptId } = request.params;
    await requireAttemptAccess(request, attemptRepository, jwtSecret, attemptId);
    const attempt = await attemptRepository.findById(attemptId);
    if (!attempt) throw notFound(`No attempt with id ${attemptId}`);
    return attempt;
  });
}
