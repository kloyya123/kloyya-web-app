import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { users } from '@kloyya/db/schema';
import { entitlementsFor } from '@kloyya/core';
import { createTestApp, signUp } from '../test/app.js';
import { incrementAskCount } from '../ask/usage.js';
import type { StartContext } from '../integrations/connect.js';

/**
 * The Ask rate limit, proven at the route — not just the counter underneath it.
 *
 * A client-side cap is a suggestion; this asserts the server itself refuses the
 * request once the day's allowance is spent, with a 429 a person can read. The
 * companion assertion is just as important: a user who is *under* the cap is let
 * through by this gate (and only then meets the "AI not configured" wall, since
 * the tests run without a provider key) — so the 429 is the limiter talking, not
 * some unrelated failure.
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

/** The free plan's daily allowance — the number this whole test is about. On the
 *  free plan this is always a real cap (null would mean unlimited, i.e. Pro). */
const FREE_LIMIT = entitlementsFor('free').askPerDay ?? 0;

async function onboardedUser(email: string): Promise<{ cookie: string; ctx: StartContext }> {
  const { cookie, userId } = await signUp(app, {
    email,
    password: 'a sufficiently long passphrase',
    name: 'Asker',
  });
  const [profile] = await db
    .select({ org: users.organizationId, ws: users.activeWorkspaceId })
    .from(users)
    .where(eq(users.id, userId));
  return { cookie, ctx: { userId, organizationId: profile!.org, workspaceId: profile!.ws! } };
}

describe('POST /v1/ask — rate limit', () => {
  it('refuses with 429 once the daily allowance is spent', async () => {
    const { cookie, ctx } = await onboardedUser('ask-limit@kloyya.test');

    // Spend the whole day's allowance through the real counter the route reads.
    for (let i = 0; i < FREE_LIMIT; i++) await incrementAskCount(db, ctx);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/ask',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { question: 'What did I miss this week?' },
    });

    expect(res.statusCode).toBe(429);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe('ask_limit_reached');
  });

  it('lets a user under the cap past the gate (only the missing AI key stops them)', async () => {
    const { cookie } = await onboardedUser('ask-under@kloyya.test');

    const res = await app.inject({
      method: 'POST',
      url: '/v1/ask',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { question: 'What did I miss this week?' },
    });

    // The tests run with no provider key, so a permitted request reaches the AI
    // layer and stops there — 503, not 429. That is the gate letting them by.
    expect(res.statusCode).toBe(503);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe('ai_unconfigured');
  });

  it('requires a session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/ask',
      headers: { 'content-type': 'application/json' },
      payload: { question: 'anyone there?' },
    });
    expect(res.statusCode).toBe(401);
  });
});
