import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import type { PGlite } from '@electric-sql/pglite';
import type { AppDb } from '@kloyya/db/client';
import { userPreferences } from '@kloyya/db/schema';
import { actAs, createTestDb, createTestIdentity, resetDeps } from '@server/test/harness';
import { POST } from './route';

/**
 * The AI-drafting gate at the route: a user who turned it off is refused (403
 * ai_drafting_disabled); an enabled user gets past the gate and meets the
 * honest "AI not configured" 503 in tests (no provider key), proving the 403 is
 * the toggle talking, not an unrelated failure.
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

function generate(): Promise<Response> {
  return POST(
    new NextRequest('http://test.local/api/v1/drafts/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'note', idea: 'a recap of the standup' }),
    }),
  );
}

describe('POST /api/v1/drafts/generate', () => {
  it('refuses when the user has AI drafting turned off', async () => {
    const identity = await createTestIdentity(db, { email: 'drafts-off@kloyya.test' });
    await db
      .update(userPreferences)
      .set({ aiDraftingEnabled: false })
      .where(eq(userPreferences.userId, identity.id));
    switchActor(identity);

    const res = await generate();
    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: { errorCode: string } };
    expect(json.error.errorCode).toBe('ai_drafting_disabled');
  });

  it('passes the gate when enabled (then meets the no-provider 503 in tests)', async () => {
    const identity = await createTestIdentity(db, { email: 'drafts-on@kloyya.test' });
    switchActor(identity);

    const res = await generate();
    expect(res.status).toBe(503);
    const json = (await res.json()) as { error: { errorCode: string } };
    expect(json.error.errorCode).toBe('ai_unconfigured');
  });
});
