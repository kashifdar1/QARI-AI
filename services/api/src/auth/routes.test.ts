import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

const JWT_SECRET = 'test-secret-at-least-16-chars';

function freshApp() {
  return buildApp({ jwtSecret: JWT_SECRET });
}

describe('POST /v1/auth/signup', () => {
  it('creates an account and returns 201 with an AuthSession', async () => {
    const app = freshApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { email: 'new@example.com', password: 'hunter2hunter2', locale: 'en' },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(body).toHaveProperty('userId');
  });

  it('returns 409 for a duplicate email', async () => {
    const app = freshApp();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { email: 'dup@example.com', password: 'hunter2hunter2' },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { email: 'dup@example.com', password: 'another-password' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe('EMAIL_TAKEN');
  });

  it('returns 400 for an invalid email', async () => {
    const app = freshApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { email: 'not-an-email', password: 'hunter2hunter2' },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('POST /v1/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const app = freshApp();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { email: 'login@example.com', password: 'hunter2hunter2' },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'login@example.com', password: 'hunter2hunter2' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('accessToken');
  });

  it('returns 401 for wrong credentials', async () => {
    const app = freshApp();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { email: 'login2@example.com', password: 'hunter2hunter2' },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'login2@example.com', password: 'wrong-password' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('UNAUTHORIZED');
  });
});

describe('POST /v1/auth/guest-session', () => {
  it('issues a working guest session with no request body', async () => {
    const app = freshApp();
    const response = await app.inject({ method: 'POST', url: '/v1/auth/guest-session' });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toHaveProperty('accessToken');
  });
});

describe('POST /v1/auth/guest-upgrade', () => {
  it('upgrades the caller\'s own guest session when a valid bearer token is presented', async () => {
    const app = freshApp();
    const guestResponse = await app.inject({ method: 'POST', url: '/v1/auth/guest-session' });
    const { accessToken } = guestResponse.json();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/guest-upgrade',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { email: 'upgraded@example.com', password: 'hunter2hunter2' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('accessToken');
  });

  it('returns 401 with no Authorization header', async () => {
    const app = freshApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/guest-upgrade',
      payload: { email: 'x@example.com', password: 'hunter2hunter2' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('returns 401 for a garbage/forged bearer token — cannot upgrade an arbitrary account by guessing a token', async () => {
    const app = freshApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/guest-upgrade',
      headers: { authorization: 'Bearer this-is-not-a-real-jwt' },
      payload: { email: 'x@example.com', password: 'hunter2hunter2' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('returns 409 when re-upgrading an already-upgraded (non-guest) account', async () => {
    const app = freshApp();
    const guestResponse = await app.inject({ method: 'POST', url: '/v1/auth/guest-session' });
    const { accessToken } = guestResponse.json();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/guest-upgrade',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { email: 'once@example.com', password: 'hunter2hunter2' },
    });
    const secondAttempt = await app.inject({
      method: 'POST',
      url: '/v1/auth/guest-upgrade',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { email: 'twice@example.com', password: 'hunter2hunter2' },
    });
    expect(secondAttempt.statusCode).toBe(409);
  });
});
