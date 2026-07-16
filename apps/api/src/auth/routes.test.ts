import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../test/app.js';

/**
 * End-to-end mount test: a real HTTP sign-up flows through the Fastify route,
 * into Better Auth, into PGLite, and comes back with a session cookie. Proves
 * the request/response adapter in routes.ts (URL, headers, JSON body, and the
 * Set-Cookie handling) actually works — not just that it compiles.
 */
let app: FastifyInstance;
let client: PGlite;

beforeAll(async () => {
  ({ app, client } = await createTestApp());
});

afterAll(async () => {
  await app.close();
  await client.close();
});

describe('POST /api/auth/sign-up/email', () => {
  it('creates a user and sets a session cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'grace@kloyya.test', password: 'a sufficiently long passphrase', name: 'Grace' },
    });

    expect(res.statusCode).toBe(200);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeTruthy();
    expect(String(setCookie)).toContain('better-auth');

    const body = res.json<{ user: { email: string; emailVerified: boolean } }>();
    expect(body.user.email).toBe('grace@kloyya.test');
  });

  it('rejects a malformed sign-up (short password) without a cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'bad@kloyya.test', password: 'x', name: 'Bad' },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});

describe('GET /v1/me (session-guarded)', () => {
  it('returns the current user when a valid session cookie is present', async () => {
    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'me@kloyya.test', password: 'a long enough passphrase', name: 'Me User' },
    });
    expect(signup.statusCode).toBe(200);
    const cookie = signup.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    expect(cookie).toContain('better-auth');

    const res = await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie } });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      data: {
        id: string;
        email: string;
        fullName: string;
        organizationId: string;
        role: string;
        jobTitle: string;
        timezone: string;
        isEmailVerified: boolean;
        hasCompletedOnboarding: boolean;
        createdAt: string;
      };
      correlationId: string;
    }>();

    // The full domain User from @kloyya/core — not just the auth identity.
    expect(body.data.email).toBe('me@kloyya.test');
    expect(body.data.fullName).toBe('Me User');
    expect(body.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(body.correlationId).toBeTruthy();

    // Sign-up provisioned a tenant: an org exists and the creator owns it.
    expect(body.data.organizationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(body.data.role).toBe('owner');
    // Fresh account: onboarding hasn't run, so the dashboard stays gated.
    expect(body.data.hasCompletedOnboarding).toBe(false);
    expect(body.data.jobTitle).toBe('');
    expect(body.data.timezone).toBe('UTC');
    expect(new Date(body.data.createdAt).toString()).not.toBe('Invalid Date');
  });

  it('rejects an unauthenticated request with a 401 KAS error envelope', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/me' });

    expect(res.statusCode).toBe(401);
    const body = res.json<{ error: { errorCode: string; httpStatus: number } }>();
    expect(body.error.errorCode).toBe('unauthorized');
    expect(body.error.httpStatus).toBe(401);
  });
});
