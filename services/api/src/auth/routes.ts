import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest, conflict, forbidden, unauthorized, type ApiError } from '../errors.js';
import { AuthError, type AuthService } from './authService.js';
import { requireAuth } from './requireAuth.js';

const signupBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  locale: z.enum(['en', 'ur', 'ar']).optional(),
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const guestUpgradeBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
});

function authErrorToApiError(err: AuthError): ApiError {
  switch (err.code) {
    case 'EMAIL_TAKEN':
      return conflict(err.message, err.code);
    case 'INVALID_CREDENTIALS':
      return unauthorized(err.message);
    case 'NOT_A_GUEST':
      return conflict(err.message, err.code);
    case 'FORBIDDEN':
      return forbidden(err.message);
  }
}

export function registerAuthRoutes(
  app: FastifyInstance,
  deps: { authService: AuthService; jwtSecret: string },
): void {
  const { authService, jwtSecret } = deps;

  app.post('/v1/auth/signup', async (request, reply) => {
    const parsed = signupBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.message);
    }
    try {
      const session = await authService.signup(
        parsed.data.email,
        parsed.data.password,
        parsed.data.locale,
      );
      reply.code(201);
      return session;
    } catch (err) {
      if (err instanceof AuthError) throw authErrorToApiError(err);
      throw err;
    }
  });

  app.post('/v1/auth/login', async (request) => {
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.message);
    }
    try {
      return await authService.login(parsed.data.email, parsed.data.password);
    } catch (err) {
      if (err instanceof AuthError) throw authErrorToApiError(err);
      throw err;
    }
  });

  app.post('/v1/auth/guest-session', async (_request, reply) => {
    const session = await authService.createGuestSession();
    reply.code(201);
    return session;
  });

  app.post('/v1/auth/guest-upgrade', async (request) => {
    const claims = requireAuth(request, jwtSecret);
    const parsed = guestUpgradeBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.message);
    }
    try {
      return await authService.upgradeGuest(claims.sub, parsed.data.email, parsed.data.password);
    } catch (err) {
      if (err instanceof AuthError) throw authErrorToApiError(err);
      throw err;
    }
  });
}
