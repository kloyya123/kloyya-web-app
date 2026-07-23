import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import type { AppDb } from '@kloyya/db/client';
import { entitlementsFor } from '@kloyya/core';
import {
  actAs,
  createTestDb,
  createTestIdentity,
  resetDeps,
  startContextFor,
} from '@server/test/harness';
import { incrementAskCount } from '@server/ask/usage';
import { POST } from './route';

/**
 * The Ask rate limit, proven at the route — a client-side cap is a suggestion,
 * so this asserts the server itself refuses once the day's allowance is spent
 * (429), and lets an under-cap request through the gate (where, with no provider
 * key in tests, it meets the honest "AI not configured" 503 — proving the 429 is
 * the limiter talking, not some unrelated failure).
 */
let client: PGlite;
let db: AppDb;
let switchActor: (next: Awaited<ReturnType<typeof createTestIdentity>> | null) => void;

beforeAll(async () => {
  ({ db, client } = await createTestDb());
  switchActor = actAs(db, null);
});

afterAll(async () => {
  resetDeps();
  await client.close();
});

const FREE_LIMIT = entitlementsFor('free').askPerDay ?? 0;

function ask(): Promise<Response> {
  return POST(
    new NextRequest('http://test.local/api/v1/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'What did I miss this week?' }),
    }),
  );
}

describe('POST /api/v1/ask — rate limit', () => {
  it('refuses with 429 once the daily allowance is spent', async () => {
    const identity = await createTestIdentity(db, { email: 'ask-limit@kloyya.test' });
    switchActor(identity);
    const ctx = await startContextFor(db, identity);

    for (let i = 0; i < FREE_LIMIT; i++) await incrementAskCount(db, ctx);

    const res = await ask();
    expect(res.status).toBe(429);
    expect((await res.json()).error.errorCode).toBe('ask_limit_reached');
  });

  it('lets a user under the cap past the gate (only the missing AI key stops them)', async () => {
    const identity = await createTestIdentity(db, { email: 'ask-under@kloyya.test' });
    switchActor(identity);

    const res = await ask();
    // No provider key in tests, so a permitted request reaches the AI layer and
    // stops there — 503, not 429. That is the gate letting them by.
    expect(res.status).toBe(503);
    expect((await res.json()).error.errorCode).toBe('ai_unconfigured');
  });

  it('requires a session', async () => {
    switchActor(null);
    const res = await ask();
    expect(res.status).toBe(401);
  });
});
