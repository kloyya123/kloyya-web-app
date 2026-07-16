import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { createTestApp, signUp } from '../test/app.js';

/**
 * The verified-email gate.
 *
 * `User.isEmailVerified` "gates workspace access" in the domain model. The
 * interface has always honoured that; these tests are the server honouring it
 * too, so the gate survives someone calling the API directly.
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

async function unverified(email: string): Promise<string> {
  const { cookie } = await signUp(
    app,
    { email, password: 'a sufficiently long passphrase', name: 'Unverified' },
    { verify: false },
  );
  return cookie;
}

describe('unverified sessions', () => {
  it('can still read their own profile — the verify screen needs it', async () => {
    const cookie = await unverified('u-me@kloyya.test');

    const res = await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie } });

    // Gating this would leave the user unable to see that they're unverified.
    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: { isEmailVerified: boolean } }>().data.isEmailVerified).toBe(false);
  });

  it.each([
    ['GET', '/v1/organization', undefined],
    ['POST', '/v1/invitations', { email: 'x@kloyya.test', role: 'employee' }],
    ['GET', '/v1/invitations', undefined],
  ] as const)('is refused %s %s', async (method, url, payload) => {
    const cookie = await unverified(`u-${url.replace(/\W/g, '')}-${method}@kloyya.test`);

    const res = await app.inject({
      method,
      url,
      headers: { cookie, ...(payload ? { 'content-type': 'application/json' } : {}) },
      ...(payload ? { payload } : {}),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe('email_not_verified');
  });

  it('is refused onboarding until the address is confirmed', async () => {
    const cookie = await unverified('u-onboard@kloyya.test');

    const res = await app.inject({
      method: 'POST',
      url: '/v1/onboarding',
      headers: { cookie, 'content-type': 'application/json' },
      payload: {
        fullName: 'Someone',
        jobTitle: 'Something',
        companyName: 'Somewhere',
        industry: 'Something',
        teamSize: '51-200',
        goals: [],
        workStyle: 'deep_focus',
        briefingTime: '07:00',
        notificationLevel: 'important_only',
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe('email_not_verified');
  });

  it('passes the gate once the emailed code is submitted', async () => {
    // The same user, now doing what a real user does.
    const { cookie } = await signUp(app, {
      email: 'u-then-verified@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Now Verified',
    });

    const res = await app.inject({ method: 'GET', url: '/v1/organization', headers: { cookie } });
    expect(res.statusCode).toBe(200);
  });
});
