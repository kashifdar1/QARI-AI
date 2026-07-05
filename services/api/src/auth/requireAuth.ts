import type { FastifyRequest } from 'fastify';
import { unauthorized } from '../errors.js';
import { verifyAccessToken, type AccessTokenClaims } from './jwt.js';

/**
 * Extracts and verifies the bearer token, returning the caller's own
 * claims. Route handlers use `claims.sub` as `actorUserId` — never a value
 * from the request body/params — so a caller can only ever act as
 * themselves (this is what makes `AuthService.upgradeGuest`'s "only your
 * own guest account" guarantee hold at the HTTP layer, not just in tests
 * that call the service directly).
 */
export function requireAuth(request: FastifyRequest, jwtSecret: string): AccessTokenClaims {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized();
  }
  const token = header.slice('Bearer '.length);
  try {
    return verifyAccessToken(token, jwtSecret);
  } catch {
    throw unauthorized('Invalid or expired token');
  }
}
