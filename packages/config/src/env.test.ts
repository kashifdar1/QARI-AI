import { describe, expect, it } from 'vitest';
import { parseApiEnv } from './env.js';

describe('parseApiEnv', () => {
  it('parses a complete valid environment', () => {
    const env = parseApiEnv({
      NODE_ENV: 'test',
      PORT: '4000',
      DATABASE_URL: 'postgres://localhost:5432/qari',
      REDIS_URL: 'redis://localhost:6379',
      OBJECT_STORAGE_ENDPOINT: 'https://storage.local',
      OBJECT_STORAGE_BUCKET: 'qari-audio',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'qari-dev',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: 'qari-dev-secret',
      SIGNED_URL_TTL_SECONDS: '600',
      JWT_SECRET: 'a-secret-at-least-16-chars',
    });
    expect(env.PORT).toBe(4000);
    expect(env.SIGNED_URL_TTL_SECONDS).toBe(600);
    expect(env.OBJECT_STORAGE_PUBLIC_ENDPOINT).toBeUndefined();
  });

  it('accepts an explicit OBJECT_STORAGE_PUBLIC_ENDPOINT', () => {
    const env = parseApiEnv({
      DATABASE_URL: 'postgres://localhost:5432/qari',
      REDIS_URL: 'redis://localhost:6379',
      OBJECT_STORAGE_ENDPOINT: 'http://localhost:9000',
      OBJECT_STORAGE_PUBLIC_ENDPOINT: 'http://10.0.2.2:9000',
      OBJECT_STORAGE_BUCKET: 'qari-audio',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'qari-dev',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: 'qari-dev-secret',
      JWT_SECRET: 'a-secret-at-least-16-chars',
    });
    expect(env.OBJECT_STORAGE_PUBLIC_ENDPOINT).toBe('http://10.0.2.2:9000');
  });

  it('rejects a missing required variable', () => {
    expect(() => parseApiEnv({})).toThrow();
  });

  it('rejects a JWT secret shorter than 16 characters', () => {
    expect(() =>
      parseApiEnv({
        DATABASE_URL: 'postgres://localhost:5432/qari',
        REDIS_URL: 'redis://localhost:6379',
        OBJECT_STORAGE_ENDPOINT: 'https://storage.local',
        OBJECT_STORAGE_BUCKET: 'qari-audio',
        OBJECT_STORAGE_ACCESS_KEY_ID: 'qari-dev',
        OBJECT_STORAGE_SECRET_ACCESS_KEY: 'qari-dev-secret',
        JWT_SECRET: 'too-short',
      }),
    ).toThrow();
  });
});
