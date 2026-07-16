import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { createTestApp, signUp, type RecordingSender } from '../test/app.js';

/**
 * Email verification and password reset, end to end — with a recording sender,
 * so the suite proves the flow without ever sending mail.
 *
 * The shape that matters: a SIX-DIGIT CODE, not a link. The frontend's
 * verify-email screen is a six-box `one-time-code` input, so a link-based flow
 * would have been a backend that quietly didn't fit the product.
 */
let app: FastifyInstance;
let client: PGlite;
let email: RecordingSender;

beforeAll(async () => {
  ({ app, client, email } = await createTestApp());
});

afterAll(async () => {
  await app.close();
  await client.close();
});

describe('email verification', () => {
  it('emails a six-digit code on sign-up, without being asked', async () => {
    await signUp(app, {
      email: 'newcomer@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Newcomer',
    });

    const message = email.lastTo('newcomer@kloyya.test');
    expect(message).toBeDefined();

    const code = email.lastCodeTo('newcomer@kloyya.test');
    expect(code).toMatch(/^\d{6}$/);

    // The subject leads with the code, so it's readable from a notification.
    expect(message?.subject).toContain(code!);
    // Both parts are present — some clients refuse HTML.
    expect(message?.html).toContain(code!);
    expect(message?.text).toContain(code!);
    // Says what to do if it wasn't you.
    expect(message?.text.toLowerCase()).toContain("didn't create");
  });

  it('verifies the account when the emailed code is submitted', async () => {
    // This test IS the verification flow, so it starts where a real user does.
    const { cookie } = await signUp(
      app,
      {
        email: 'verifyme@kloyya.test',
        password: 'a sufficiently long passphrase',
        name: 'Verify Me',
      },
      { verify: false },
    );

    // Unverified to begin with — this is what gates the dashboard.
    const before = await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie } });
    expect(before.json<{ data: { isEmailVerified: boolean } }>().data.isEmailVerified).toBe(false);

    const code = email.lastCodeTo('verifyme@kloyya.test');
    expect(code).toMatch(/^\d{6}$/);

    const verified = await app.inject({
      method: 'POST',
      url: '/api/auth/email-otp/verify-email',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'verifyme@kloyya.test', otp: code },
    });
    expect(verified.statusCode).toBe(200);

    const after = await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie } });
    expect(after.json<{ data: { isEmailVerified: boolean } }>().data.isEmailVerified).toBe(true);
  });

  it('rejects a wrong code and leaves the account unverified', async () => {
    const { cookie } = await signUp(
      app,
      {
        email: 'wrongcode@kloyya.test',
        password: 'a sufficiently long passphrase',
        name: 'Wrong Code',
      },
      { verify: false },
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/email-otp/verify-email',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'wrongcode@kloyya.test', otp: '000000' },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);

    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie } });
    expect(me.json<{ data: { isEmailVerified: boolean } }>().data.isEmailVerified).toBe(false);
  });
});

describe('password reset', () => {
  it('emails a reset code that reads as a reset, not a verification', async () => {
    await signUp(app, {
      email: 'forgetful@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Forgetful',
    });
    const sentBefore = email.sent.length;

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/email-otp/send-verification-otp',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'forgetful@kloyya.test', type: 'forget-password' },
    });
    expect(res.statusCode).toBe(200);
    expect(email.sent.length).toBeGreaterThan(sentBefore);

    const message = email.lastTo('forgetful@kloyya.test');
    expect(message?.subject.toLowerCase()).toContain('reset');
    expect(email.lastCodeTo('forgetful@kloyya.test')).toMatch(/^\d{6}$/);
    expect(message?.text.toLowerCase()).toContain('password stays as it is');
  });

  it('does not reveal whether an address is registered', async () => {
    // Returning 404 here would turn the forgot-password form into an
    // account-enumeration oracle — the same rule the frontend's mock encodes.
    const known = await app.inject({
      method: 'POST',
      url: '/api/auth/email-otp/send-verification-otp',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'forgetful@kloyya.test', type: 'forget-password' },
    });
    const unknown = await app.inject({
      method: 'POST',
      url: '/api/auth/email-otp/send-verification-otp',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'nobody-here@kloyya.test', type: 'forget-password' },
    });

    expect(unknown.statusCode).toBe(known.statusCode);
  });
});
