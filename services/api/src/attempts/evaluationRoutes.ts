import { buildFeedback, type ProfileAgeClass } from '@qari/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest, notFound } from '../errors.js';
import { requireAttemptAccess } from './attemptAccess.js';
import type { AttemptRepository } from './attemptRepository.js';
import type { EvaluationResultRepository } from './evaluationResultRepository.js';
import type { ReportRepository } from './reportRepository.js';
import { requireAuth } from '../auth/requireAuth.js';

const reportBodySchema = z.object({
  reason: z.string().min(1),
});

export function registerEvaluationRoutes(
  app: FastifyInstance,
  deps: {
    attemptRepository: AttemptRepository;
    evaluationResultRepository: EvaluationResultRepository;
    reportRepository: ReportRepository;
    jwtSecret: string;
    referenceAudioBaseUrl: string;
    /** Resolves the profile-age policy for an attempt (ADR-005 child abstention). Defaults to 'adult' if not provided (Milestone D wires real profile lookups). */
    resolveProfileAgeClass?: (attemptId: string) => Promise<ProfileAgeClass>;
  },
): void {
  const { attemptRepository, evaluationResultRepository, reportRepository, jwtSecret, referenceAudioBaseUrl } = deps;
  const resolveProfileAgeClass = deps.resolveProfileAgeClass ?? (async () => 'adult' as const);

  app.get<{ Params: { attemptId: string } }>('/v1/attempts/:attemptId/evaluation', async (request) => {
    const { attemptId } = request.params;
    await requireAttemptAccess(request, attemptRepository, jwtSecret, attemptId);

    const attempt = await attemptRepository.findById(attemptId);
    if (!attempt) throw notFound(`No attempt with id ${attemptId}`);
    const result = await evaluationResultRepository.findLatestForAttempt(attemptId);

    return {
      attemptId,
      status: attempt.status,
      modelBundleVersion: result?.modelBundleVersion ?? null,
      contentVersionId: result?.contentVersionId ?? null,
    };
  });

  app.get<{ Params: { attemptId: string } }>('/v1/attempts/:attemptId/feedback', async (request) => {
    const { attemptId } = request.params;
    await requireAttemptAccess(request, attemptRepository, jwtSecret, attemptId);

    const result = await evaluationResultRepository.findLatestForAttempt(attemptId);
    if (!result) throw notFound(`No evaluation result yet for attempt ${attemptId}`);

    const profileAgeClass = await resolveProfileAgeClass(attemptId);

    return buildFeedback({
      evaluationStatus: result.status,
      passageVersion: result.contentVersionId,
      modelBundleVersion: result.modelBundleVersion,
      audioQuality: {
        passed: result.status === 'completed',
        durationSeconds: result.audioQualityDurationSeconds,
        failureReasons: result.audioQualityFailureReasons,
      },
      wordSegments: result.wordSegments,
      rawIssueCandidates: result.issueCandidates,
      profileAgeClass,
      referenceAudioBaseUrl,
    });
  });

  app.post<{ Params: { attemptId: string } }>('/v1/attempts/:attemptId/report', async (request, reply) => {
    const { attemptId } = request.params;
    await requireAttemptAccess(request, attemptRepository, jwtSecret, attemptId);
    const claims = requireAuth(request, jwtSecret);

    const parsed = reportBodySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest(parsed.error.message);

    const result = await evaluationResultRepository.findLatestForAttempt(attemptId);
    if (!result) throw notFound(`No evaluation result yet for attempt ${attemptId}`);

    const report = await reportRepository.insert({
      evaluationResultId: result.id,
      reportedByUserId: claims.sub,
      reason: parsed.data.reason,
    });
    reply.code(201);
    return report;
  });
}
