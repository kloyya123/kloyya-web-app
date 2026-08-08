import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import type { AppDb } from '@kloyya/db/client';
import { actAs, createTestDb, createTestIdentity, resetDeps, startContextFor } from '@server/test/harness';
import { createNotification } from '@server/notifications/service';
import { GET } from './route';
import { PATCH } from './[id]/route';
import { POST as MARK_ALL_READ } from './mark-all-read/route';
import { POST as SUBSCRIBE, DELETE as UNSUBSCRIBE } from './push-subscriptions/route';

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

function list(): Promise<Response> {
  return GET(new NextRequest('http://test.local/api/v1/notifications'));
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/v1/notifications', () => {
  it('lists this workspace’s notifications, ranked by decision score', async () => {
    const identity = await createTestIdentity(db, { email: 'notifications-route@kloyya.test' });
    const ctx = await startContextFor(db, identity);
    await createNotification(db, {
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      category: 'ai',
      title: 'Low',
      body: 'x',
      decisionScore: 10,
    });
    await createNotification(db, {
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      category: 'ai',
      title: 'High',
      body: 'x',
      decisionScore: 95,
    });
    switchActor(identity);

    const res = await list();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { title: string }[] };
    expect(json.data.map((n) => n.title)).toEqual(['High', 'Low']);
  });

  it('requires a session — 401 with the KAS envelope', async () => {
    switchActor(null);
    const res = await list();
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: { errorCode: string } };
    expect(json.error.errorCode).toBe('unauthorized');
  });
});

describe('PATCH /api/v1/notifications/[id]', () => {
  it('marks a notification read', async () => {
    const identity = await createTestIdentity(db, { email: 'notifications-patch@kloyya.test' });
    const ctx = await startContextFor(db, identity);
    const notification = await createNotification(db, {
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      category: 'system',
      title: 'x',
      body: 'x',
      decisionScore: 50,
    });
    switchActor(identity);

    const res = await PATCH(
      new NextRequest(`http://test.local/api/v1/notifications/${notification.id}`, { method: 'PATCH' }),
      params(notification.id),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { isRead: boolean } };
    expect(json.data.isRead).toBe(true);
  });

  it('404s an unknown id', async () => {
    const identity = await createTestIdentity(db, { email: 'notifications-patch-missing@kloyya.test' });
    switchActor(identity);
    const id = '00000000-0000-0000-0000-000000000000';
    const res = await PATCH(
      new NextRequest(`http://test.local/api/v1/notifications/${id}`, { method: 'PATCH' }),
      params(id),
    );
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/notifications/mark-all-read', () => {
  it('marks every unread notification read and reports the count', async () => {
    const identity = await createTestIdentity(db, { email: 'notifications-markall@kloyya.test' });
    const ctx = await startContextFor(db, identity);
    await createNotification(db, {
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      category: 'system',
      title: 'a',
      body: 'x',
      decisionScore: 10,
    });
    await createNotification(db, {
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      category: 'system',
      title: 'b',
      body: 'x',
      decisionScore: 20,
    });
    switchActor(identity);

    const res = await MARK_ALL_READ(new NextRequest('http://test.local/api/v1/notifications/mark-all-read', { method: 'POST' }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { changed: number } };
    expect(json.data.changed).toBe(2);
  });
});

describe('/api/v1/notifications/push-subscriptions', () => {
  it('subscribes and unsubscribes a browser', async () => {
    const identity = await createTestIdentity(db, { email: 'notifications-push@kloyya.test' });
    switchActor(identity);

    const subscribed = await SUBSCRIBE(
      new NextRequest('http://test.local/api/v1/notifications/push-subscriptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'https://push.example.com/abc',
          keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
        }),
      }),
    );
    expect(subscribed.status).toBe(200);

    const unsubscribed = await UNSUBSCRIBE(
      new NextRequest('http://test.local/api/v1/notifications/push-subscriptions', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: 'https://push.example.com/abc' }),
      }),
    );
    expect(unsubscribed.status).toBe(200);
  });

  it('rejects a malformed endpoint with a 422 envelope', async () => {
    const identity = await createTestIdentity(db, { email: 'notifications-push-invalid@kloyya.test' });
    switchActor(identity);

    const res = await SUBSCRIBE(
      new NextRequest('http://test.local/api/v1/notifications/push-subscriptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: 'not-a-url', keys: { p256dh: 'x', auth: 'y' } }),
      }),
    );
    expect(res.status).toBe(422);
  });
});
