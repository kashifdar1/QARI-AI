import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuthService } from './auth/authService.js';
import { registerAuthRoutes } from './auth/routes.js';
import { InMemoryUserRepository, type UserRepository } from './auth/userRepository.js';
import { InMemoryAttemptRepository, type AttemptRepository } from './attempts/attemptRepository.js';
import {
  InMemoryEvaluationResultRepository,
  type EvaluationResultRepository,
} from './attempts/evaluationResultRepository.js';
import { InMemoryEvaluationQueue, type EvaluationQueue } from './attempts/evaluationQueue.js';
import { registerEvaluationRoutes } from './attempts/evaluationRoutes.js';
import { FakeObjectStorage, type ObjectStorage } from './attempts/objectStorage.js';
import { InMemoryReportRepository, type ReportRepository } from './attempts/reportRepository.js';
import { registerAttemptRoutes } from './attempts/routes.js';
import { ContentService } from './content/contentService.js';
import { registerContentRoutes } from './content/routes.js';
import { InMemoryContentRepository, type ContentRepository } from './content-import/contentRepository.js';
import {
  InMemoryReciterAudioRepository,
  type ReciterAudioRepository,
} from './content-import/reciterAudioRepository.js';
import { ApiError } from './errors.js';
import { buildLoggerOptions } from './logging/logger.js';

export type BuildAppOptions = {
  jwtSecret: string;
  userRepository?: UserRepository;
  contentRepository?: ContentRepository;
  reciterAudioRepository?: ReciterAudioRepository;
  attemptRepository?: AttemptRepository;
  evaluationQueue?: EvaluationQueue;
  evaluationResultRepository?: EvaluationResultRepository;
  reportRepository?: ReportRepository;
  objectStorage?: ObjectStorage;
  publicObjectBaseUrl?: string;
  signedUrlTtlSeconds?: number;
  /** Test-only hook to capture emitted logs; production leaves this unset (stdout). */
  loggerStream?: NodeJS.WritableStream;
};

/**
 * Route implementations are added against the OpenAPI contract in
 * packages/api-contracts/openapi.yaml as each area is built out; this
 * milestone wires up health, the auth surface (signup/login/guest-session/
 * guest-upgrade), the public content surface (passages list/detail), and
 * the attempt lifecycle (create/upload-url/complete/read), a shared error
 * envelope, and a logger with the ADR-004 URL-redaction hook applied by
 * construction (see logging/logger.ts).
 */
export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: buildLoggerOptions(options.loggerStream) });

  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof ApiError) {
      reply.code(err.statusCode).send(err.toEnvelope());
      return;
    }
    // Fastify itself and its plugins (e.g. @fastify/rate-limit's 429) throw
    // errors carrying a real `statusCode` that aren't our ApiError class —
    // those are legitimate 4xx responses, not server failures, and must
    // not be flattened to 500.
    if (err instanceof Error && 'statusCode' in err) {
      const statusCode = err.statusCode;
      if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
        reply.code(statusCode).send({ code: 'CLIENT_ERROR', message: err.message });
        return;
      }
    }
    app.log.error(err);
    reply.code(500).send({ code: 'INTERNAL_ERROR', message: 'Something went wrong' });
  });

  app.get('/v1/health', async () => {
    return { status: 'ok' as const };
  });

  const userRepository = options.userRepository ?? new InMemoryUserRepository();
  const authService = new AuthService(userRepository, options.jwtSecret);
  registerAuthRoutes(app, { authService, jwtSecret: options.jwtSecret });

  const attemptRepository = options.attemptRepository ?? new InMemoryAttemptRepository();
  const evaluationQueue = options.evaluationQueue ?? new InMemoryEvaluationQueue();
  const objectStorage = options.objectStorage ?? new FakeObjectStorage();
  registerAttemptRoutes(app, {
    attemptRepository,
    evaluationQueue,
    objectStorage,
    jwtSecret: options.jwtSecret,
    signedUrlTtlSeconds: options.signedUrlTtlSeconds ?? 300,
  });

  const evaluationResultRepository = options.evaluationResultRepository ?? new InMemoryEvaluationResultRepository();
  const reportRepository = options.reportRepository ?? new InMemoryReportRepository();
  registerEvaluationRoutes(app, {
    attemptRepository,
    evaluationResultRepository,
    reportRepository,
    jwtSecret: options.jwtSecret,
    referenceAudioBaseUrl: options.publicObjectBaseUrl ?? 'https://content.qari.app',
  });

  // Content is public-read (openapi.yaml: security: []). Rate limiting,
  // not auth, is the control on this unauthenticated surface — scoped to
  // this prefix only so auth/other routes are unaffected.
  void app.register(async (contentScope) => {
    await contentScope.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
    });

    const contentRepository = options.contentRepository ?? new InMemoryContentRepository();
    const reciterAudioRepository = options.reciterAudioRepository ?? new InMemoryReciterAudioRepository();
    const contentService = new ContentService(
      contentRepository,
      reciterAudioRepository,
      options.publicObjectBaseUrl ?? 'https://content.qari.app',
    );
    registerContentRoutes(contentScope, { contentService });
  });

  return app;
}
