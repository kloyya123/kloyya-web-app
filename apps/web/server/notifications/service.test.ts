import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { AppDb } from '@kloyya/db/client';
import { createTestDb, createTestIdentity, startContextFor } from '../test/harness';
import type { StartContext } from '../tenant';
import { createNotification, listNotifications, markAllNotificationsRead, markNotificationRead } from './service';

/**
 * Notifications over the real DB. What matters: ranking is by decision score
 * (not creation order), mark-read is workspace-scoped (RLS), and mark-all
 * only touches what was actually unread.
 */
let client: PGlite;
let db: AppDb;

beforeAll(async () => {
  ({ db, client } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

async function workspace(email: string): Promise<StartContext> {
  const identity = await createTestIdentity(db, { email, name: 'Owner' });
  return startContextFor(db, identity);
}

function notificationInput(ctx: StartContext, overrides: Partial<Parameters<typeof createNotification>[1]> = {}) {
  return {
    organizationId: ctx.organizationId,
    workspaceId: ctx.workspaceId,
    category: 'ai' as const,
    title: 'Something happened',
    body: 'Details.',
    decisionScore: 50,
    ...overrides,
  };
}

describe('notifications', () => {
  it('creates and lists a notification, ranked by decision score', async () => {
    const ctx = await workspace('notifications-rank@kloyya.test');
    const low = await createNotification(db, notificationInput(ctx, { title: 'Low', decisionScore: 20 }));
    const high = await createNotification(db, notificationInput(ctx, { title: 'High', decisionScore: 90 }));

    const list = await listNotifications(db, ctx);
    expect(list.map((n) => n.id)).toEqual([high.id, low.id]);
  });

  it('starts unread and can be marked read', async () => {
    const ctx = await workspace('notifications-read@kloyya.test');
    const created = await createNotification(db, notificationInput(ctx));
    expect(created.isRead).toBe(false);

    const updated = await markNotificationRead(db, ctx, created.id);
    expect(updated?.isRead).toBe(true);

    const [refetched] = await listNotifications(db, ctx);
    expect(refetched?.isRead).toBe(true);
  });

  it('returns null marking an unknown id read', async () => {
    const ctx = await workspace('notifications-missing@kloyya.test');
    const id = '00000000-0000-0000-0000-000000000000';
    expect(await markNotificationRead(db, ctx, id)).toBeNull();
  });

  it('marks only unread notifications, and reports how many changed', async () => {
    const ctx = await workspace('notifications-markall@kloyya.test');
    const first = await createNotification(db, notificationInput(ctx, { title: 'First' }));
    await createNotification(db, notificationInput(ctx, { title: 'Second' }));
    await markNotificationRead(db, ctx, first.id);

    const changed = await markAllNotificationsRead(db, ctx);
    expect(changed).toBe(1);

    const list = await listNotifications(db, ctx);
    expect(list.every((n) => n.isRead)).toBe(true);
  });

  it('keeps notifications workspace-scoped', async () => {
    const ctxA = await workspace('notifications-tenant-a@kloyya.test');
    const ctxB = await workspace('notifications-tenant-b@kloyya.test');
    await createNotification(db, notificationInput(ctxA, { title: 'Only A' }));

    expect(await listNotifications(db, ctxB)).toHaveLength(0);
    expect(await listNotifications(db, ctxA)).toHaveLength(1);
  });
});
