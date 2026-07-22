import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/requireAuth.js';
import { badRequest, forbidden, notFound } from '../errors.js';
import type { ContentRepository } from '../content-import/contentRepository.js';
import type { ProfileRepository } from './profileRepository.js';
import type { SessionRepository } from './sessionRepository.js';

const createProfileBodySchema = z.object({
  displayName: z.string().min(1),
  profileType: z.enum(['adult', 'child']),
  locale: z.enum(['en', 'ur', 'ar']).optional(),
});

const createSessionBodySchema = z.object({
  profileId: z.string().min(1),
  passageId: z.string().min(1),
});

/**
 * Profile + practice-session creation — the piece of the attempt lifecycle
 * (Milestone C) that was missing entirely: attempts are created against a
 * session (`POST /v1/sessions/:sessionId/attempts`), and sessions are
 * created against a profile, but no route created either row until this.
 */
export function registerSessionRoutes(
  app: FastifyInstance,
  deps: {
    profileRepository: ProfileRepository;
    sessionRepository: SessionRepository;
    contentRepository: ContentRepository;
    jwtSecret: string;
  },
): void {
  const { profileRepository, sessionRepository, contentRepository, jwtSecret } = deps;

  app.post('/v1/profiles', async (request, reply) => {
    const claims = requireAuth(request, jwtSecret);
    const parsed = createProfileBodySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest(parsed.error.message);

    const profile = await profileRepository.insert({
      ownerUserId: claims.sub,
      displayName: parsed.data.displayName,
      profileType: parsed.data.profileType,
      locale: parsed.data.locale ?? 'en',
    });
    reply.code(201);
    return profile;
  });

  app.post('/v1/sessions', async (request, reply) => {
    const claims = requireAuth(request, jwtSecret);
    const parsed = createSessionBodySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest(parsed.error.message);

    const profile = await profileRepository.findById(parsed.data.profileId);
    if (!profile) throw notFound(`No profile with id ${parsed.data.profileId}`);
    if (profile.ownerUserId !== claims.sub) throw forbidden();

    const passage = await contentRepository.findPassage(parsed.data.passageId);
    if (!passage) throw notFound(`No passage with id ${parsed.data.passageId}`);

    const session = await sessionRepository.insert({
      profileId: parsed.data.profileId,
      passageId: parsed.data.passageId,
    });
    reply.code(201);
    return session;
  });
}
