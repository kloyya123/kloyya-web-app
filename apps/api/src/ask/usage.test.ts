import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { users } from '@kloyya/db/schema';
import { createTestApp, signUp } from '../test/app.js';
import type { StartContext } from '../integrations/connect.js';
import { getAskCountToday, incrementAskCount } from './usage.js';

/**
 * The daily Ask counter — the thing the Free plan's limit reads. What matters:
 * it counts within a workspace-day, rolls over to zero on a new UTC day, and one
 * workspace can neither see nor spend another's allowance (RLS on ask_usage).
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

async function workspace(email: string): Promise<StartContext> {
  const { userId } = await signUp(app, { email, password: 'a sufficiently long passphrase', name: 'Counter' });
  const [profile] = await db
    .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
    .from(users)
    .where(eq(users.id, userId));
  return { userId, workspaceId: profile!.wsId!, organizationId: profile!.orgId };
}

const day1 = new Date('2026-07-18T09:00:00Z');
const day2 = new Date('2026-07-19T09:00:00Z');

describe('ask usage', () => {
  it('starts at zero and counts up within a day', async () => {
    const ctx = await workspace('usage-count@kloyya.test');
    expect(await getAskCountToday(db, ctx, day1)).toBe(0);

    await incrementAskCount(db, ctx, day1);
    await incrementAskCount(db, ctx, day1);
    expect(await getAskCountToday(db, ctx, day1)).toBe(2);
  });

  it('rolls over to zero on a new UTC day', async () => {
    const ctx = await workspace('usage-rollover@kloyya.test');
    await incrementAskCount(db, ctx, day1);
    await incrementAskCount(db, ctx, day1);
    expect(await getAskCountToday(db, ctx, day1)).toBe(2);
    // A new day is a row that doesn't exist yet — no cleanup, just zero.
    expect(await getAskCountToday(db, ctx, day2)).toBe(0);
  });

  it('keeps each workspace’s count to itself', async () => {
    const a = await workspace('usage-tenant-a@kloyya.test');
    const b = await workspace('usage-tenant-b@kloyya.test');
    await incrementAskCount(db, a, day1);
    await incrementAskCount(db, a, day1);
    await incrementAskCount(db, a, day1);

    expect(await getAskCountToday(db, a, day1)).toBe(3);
    // B never asked — RLS + workspace scope keep A's usage out of B's view.
    expect(await getAskCountToday(db, b, day1)).toBe(0);
  });
});
