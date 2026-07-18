import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { memberships } from '@kloyya/db/schema';
import { createTestApp, signUp } from '../test/app.js';

/**
 * Checkout, end to end. Free activates straight through; Pro needs a (tokenised)
 * payment method or it's a 400; and only an owner may change the plan — the same
 * authorization that guards renaming the org.
 */
let app: FastifyInstance;
let client: PGlite;
let db: AppDb;

beforeAll(async () => {
  ({ app, client, db } = await createTestApp());
});

afterAll(async () => {
  await app.close();
  await client.close();
});

async function checkout(cookie: string, payload: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: '/v1/billing/checkout',
    headers: { cookie, 'content-type': 'application/json' },
    payload,
  });
}

describe('POST /v1/billing/checkout', () => {
  it('activates Free with no payment method', async () => {
    const { cookie } = await signUp(app, {
      email: 'bill-free@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Free User',
    });

    const res = await checkout(cookie, { tier: 'free' });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: { tier: string; status: string } }>().data).toMatchObject({
      tier: 'free',
      status: 'active',
    });

    // And a subsequent /me reflects the tier on the org.
    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie } });
    // (the org tier rides on the session, asserted more fully in onboarding tests)
    expect(me.statusCode).toBe(200);
  });

  it('activates Pro when a tokenised card is supplied', async () => {
    const { cookie } = await signUp(app, {
      email: 'bill-pro@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Pro User',
    });

    const res = await checkout(cookie, {
      tier: 'pro',
      paymentMethod: { token: 'tok_from_client', saveForFuture: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: { tier: string } }>().data.tier).toBe('pro');
  });

  it('refuses Pro without a payment method — 400, not a silent free upgrade', async () => {
    const { cookie } = await signUp(app, {
      email: 'bill-nopay@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'No Card',
    });

    const res = await checkout(cookie, { tier: 'pro' });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe('payment_required');
  });

  it('forbids a non-owner from changing the plan', async () => {
    const { cookie, userId } = await signUp(app, {
      email: 'bill-employee@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Employee',
    });
    await db.update(memberships).set({ role: 'employee' }).where(eq(memberships.userId, userId));

    const res = await checkout(cookie, { tier: 'free' });
    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe('forbidden');
  });

  it('requires a session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/billing/checkout',
      headers: { 'content-type': 'application/json' },
      payload: { tier: 'free' },
    });
    expect(res.statusCode).toBe(401);
  });
});
