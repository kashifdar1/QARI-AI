import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const JWT_SECRET = 'test-secret-at-least-16-chars';

describe('GET /v1/health', () => {
  it('returns ok', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET });
    const response = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});

describe('error envelope', () => {
  it('returns { code, message } for a validation error, matching the OpenAPI Error schema', async () => {
    const app = buildApp({ jwtSecret: JWT_SECRET });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { email: 'not-an-email', password: 'short' },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body).toHaveProperty('code');
    expect(body).toHaveProperty('message');
  });
});
