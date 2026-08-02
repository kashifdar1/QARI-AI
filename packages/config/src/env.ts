import { z } from 'zod';

/**
 * Shared environment schema for services/api. Validated at process startup;
 * fail fast rather than run with an undefined config value.
 */
export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  OBJECT_STORAGE_ENDPOINT: z.string().url(),
  /** Host used for URLs handed to clients (presigned uploads, reference
   * audio) — distinct from OBJECT_STORAGE_ENDPOINT, which the server/worker
   * use for their own direct S3 SDK calls. Needed whenever the two aren't
   * reachable at the same address, e.g. local dev against an Android
   * emulator, which can't resolve the host's "localhost". Falls back to
   * OBJECT_STORAGE_ENDPOINT when unset, which is correct in every
   * environment where server and client share a reachable host (staging,
   * production, iOS simulator, physical-device-on-same-LAN dev). */
  OBJECT_STORAGE_PUBLIC_ENDPOINT: z.string().url().optional(),
  OBJECT_STORAGE_BUCKET: z.string().min(1),
  OBJECT_STORAGE_ACCESS_KEY_ID: z.string().min(1),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  JWT_SECRET: z.string().min(16),
  INFERENCE_SERVICE_URL: z.string().url().default('http://127.0.0.1:8000'),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function parseApiEnv(raw: Record<string, string | undefined>): ApiEnv {
  return apiEnvSchema.parse(raw);
}
