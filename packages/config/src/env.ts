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
