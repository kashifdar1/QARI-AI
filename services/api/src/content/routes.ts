import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest } from '../errors.js';
import type { ContentService } from './contentService.js';

const listQuerySchema = z.object({
  surahNumber: z.coerce.number().int().min(1).max(114).optional(),
});

/**
 * Content is intentionally public-read (security: [] in openapi.yaml) —
 * unlike every other route registered in app.ts, these never call
 * requireAuth. Rate limiting (registered in app.ts via @fastify/rate-limit,
 * scoped to this /v1/content prefix) is the control on an unauthenticated
 * surface, not an auth check.
 */
export function registerContentRoutes(app: FastifyInstance, deps: { contentService: ContentService }): void {
  const { contentService } = deps;

  app.get('/v1/content/passages', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw badRequest(parsed.error.message);
    }

    const etag = await contentService.getContentEtag();
    if (request.headers['if-none-match'] === etag) {
      reply.code(304);
      return null;
    }

    const items = await contentService.listPassages(parsed.data.surahNumber);
    reply.header('ETag', etag);
    reply.header('Cache-Control', 'public, max-age=60');
    return { items };
  });

  app.get<{ Params: { passageId: string } }>('/v1/content/passages/:passageId', async (request, reply) => {
    const etag = await contentService.getContentEtag();
    if (request.headers['if-none-match'] === etag) {
      reply.code(304);
      return null;
    }

    const detail = await contentService.getPassageDetail(request.params.passageId);
    reply.header('ETag', etag);
    reply.header('Cache-Control', 'public, max-age=60');
    return detail;
  });
}
