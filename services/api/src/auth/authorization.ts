import { canAccessProfile, type ProfileAccessContext } from '@qari/domain';

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
  }
}

/**
 * Fastify-facing wrapper around packages/domain's canAccessProfile — this
 * is the ONLY place a route is allowed to decide "does this caller own this
 * profile"; route handlers call this instead of comparing ids inline, so
 * the rule can't drift between routes (CLAUDE.md §5 object-level auth
 * requirement).
 */
export function requireProfileAccess(actorUserId: string, profile: ProfileAccessContext): void {
  if (!canAccessProfile(actorUserId, profile)) {
    throw new ForbiddenError('You do not have access to this profile');
  }
}
