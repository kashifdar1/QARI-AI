import type { FastifyRequest } from 'fastify';
import { ForbiddenError, requireProfileAccess } from '../auth/authorization.js';
import { forbidden, notFound } from '../errors.js';
import { requireAuth } from '../auth/requireAuth.js';
import type { AttemptRepository, SessionOwnership } from './attemptRepository.js';

/** requireProfileAccess throws packages/domain's plain ForbiddenError; the
 * shared HTTP error envelope (errors.ts's ApiError) is what app.ts's error
 * handler knows how to turn into a 403 — this bridges the two. */
export function assertProfileAccess(actorUserId: string, profile: { ownerUserId: string }): void {
  try {
    requireProfileAccess(actorUserId, profile);
  } catch (err) {
    if (err instanceof ForbiddenError) throw forbidden(err.message);
    throw err;
  }
}

export async function requireAttemptAccess(
  request: FastifyRequest,
  attemptRepository: AttemptRepository,
  jwtSecret: string,
  attemptId: string,
): Promise<SessionOwnership> {
  const claims = requireAuth(request, jwtSecret);
  const ownership = await attemptRepository.findOwnershipForAttempt(attemptId);
  if (!ownership) throw notFound(`No attempt with id ${attemptId}`);
  assertProfileAccess(claims.sub, { ownerUserId: ownership.ownerUserId });
  return ownership;
}
