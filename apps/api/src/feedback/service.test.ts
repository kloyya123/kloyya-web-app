import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { users } from '@kloyya/db/schema';
import { createTestApp, signUp } from '../test/app.js';
import type { StartContext } from '../integrations/connect.js';
import { feedbackSummary, submitFeedback } from './service.js';

/**
 * Beta feedback: it records each kind, tallies them for the status panel, and
 * keeps one workspace's feedback (and counts) out of another's.
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
  const { userId } = await signUp(app, { email, password: 'a sufficiently long passphrase', name: 'Beta User' });
  const [profile] = await db
    .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
    .from(users)
    .where(eq(users.id, userId));
  return { userId, workspaceId: profile!.wsId!, organizationId: profile!.orgId };
}

describe('feedback service', () => {
  it('records each kind and tallies them for the beta-status panel', async () => {
    const ctx = await workspace('feedback-tally@kloyya.test');
    await submitFeedback(db, ctx, { type: 'feature_request', title: 'Dark mode', body: 'please', category: 'design' });
    await submitFeedback(db, ctx, { type: 'bug', title: 'Crash', body: 'on save', category: 'documents' });
    await submitFeedback(db, ctx, { type: 'bug', title: 'Slow', body: 'search', category: 'search' });
    await submitFeedback(db, ctx, { type: 'general', title: '', body: 'love it', rating: 5 });

    const summary = await feedbackSummary(db, ctx);
    expect(summary).toMatchObject({
      featureRequests: 1,
      bugsReported: 2,
      generalFeedback: 1,
      total: 4,
    });
  });

  it('returns a receipt with the kind and time', async () => {
    const ctx = await workspace('feedback-receipt@kloyya.test');
    const receipt = await submitFeedback(db, ctx, { type: 'general', title: '', body: 'hi' });
    expect(receipt.type).toBe('general');
    expect(typeof receipt.createdAt).toBe('string');
  });

  it('keeps each workspace’s feedback to itself', async () => {
    const a = await workspace('feedback-tenant-a@kloyya.test');
    const b = await workspace('feedback-tenant-b@kloyya.test');
    await submitFeedback(db, a, { type: 'bug', title: 'A only', body: 'x' });

    expect((await feedbackSummary(db, b)).total).toBe(0);
  });
});
