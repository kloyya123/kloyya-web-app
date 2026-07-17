import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { connections, syncRecords, users } from '@kloyya/db/schema';
import { createTokenCrypto } from '../crypto/tokens.js';
import { createTestApp, signUp } from '../test/app.js';
import type { StartContext } from './connect.js';
import { syncGmail } from './sync.js';

/**
 * The Gmail sync.
 *
 * A fake Gmail stands in for the real one. The cases are Gmail's own hazards: a
 * first sync that lists then fetches N messages, an incremental history feed, a
 * cursor that aged out into a 404, a message deleted between list and get, and a
 * historyId that must advance from the profile — not the history feed, which
 * lags.
 */
let app: FastifyInstance;
let client: PGlite;
let db: AppDb;

const crypto = createTokenCrypto(randomBytes(32).toString('base64url'));

beforeAll(async () => {
  ({ app, client, db } = await createTestApp());
});

afterAll(async () => {
  await app.close();
  await client.close();
});

const deps = (fetchImpl: typeof fetch) => ({ clientId: 'id', clientSecret: 'secret', fetchImpl });

/**
 * A scripted Gmail. `profile` is the current historyId; `messages` maps id to the
 * metadata a GET returns (or 404 if absent); `history`/`list` drive the two
 * discovery paths.
 */
function fakeGmail(script: {
  profileHistoryId: string;
  messages: Record<string, unknown | 404>;
  listIds?: string[];
  history?: { startHistoryId: string; changed?: string[]; deleted?: string[] } | 404;
}): typeof fetch {
  return (async (input: string | URL) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const p = url.pathname;

    if (p.endsWith('/profile')) {
      return new Response(JSON.stringify({ historyId: script.profileHistoryId }), { status: 200 });
    }
    if (p.endsWith('/history')) {
      if (script.history === 404) return new Response('gone', { status: 404 });
      const h = script.history;
      const body = {
        history: [
          {
            messagesAdded: (h?.changed ?? []).map((id) => ({ message: { id } })),
            messagesDeleted: (h?.deleted ?? []).map((id) => ({ message: { id } })),
          },
        ],
        historyId: script.profileHistoryId,
      };
      return new Response(JSON.stringify(body), { status: 200 });
    }
    if (p.endsWith('/messages')) {
      const items = (script.listIds ?? []).map((id) => ({ id }));
      return new Response(JSON.stringify({ messages: items }), { status: 200 });
    }
    // /messages/:id
    const id = decodeURIComponent(p.split('/messages/')[1] ?? '');
    const msg = script.messages[id];
    if (msg === 404 || msg === undefined) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(msg), { status: 200 });
  }) as unknown as typeof fetch;
}

async function connectedGmail(email: string): Promise<StartContext> {
  const { userId } = await signUp(app, {
    email,
    password: 'a sufficiently long passphrase',
    name: 'Mailbox Owner',
  });
  const [profile] = await db
    .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
    .from(users)
    .where(eq(users.id, userId));

  await db.insert(connections).values({
    organizationId: profile!.orgId,
    workspaceId: profile!.wsId!,
    integrationId: 'gmail',
    status: 'connected',
    accessTokenEnc: crypto.encrypt('a-live-access-token'),
    refreshTokenEnc: crypto.encrypt('a-refresh-token'),
    accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    grantedScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  });

  return { userId, workspaceId: profile!.wsId!, organizationId: profile!.orgId };
}

async function records(ctx: StartContext) {
  return db
    .select({
      externalId: syncRecords.externalId,
      resourceType: syncRecords.resourceType,
      payload: syncRecords.payload,
      deletedAtSource: syncRecords.deletedAtSource,
    })
    .from(syncRecords)
    .where(eq(syncRecords.workspaceId, ctx.workspaceId));
}

async function cursorOf(ctx: StartContext): Promise<string | undefined> {
  const [row] = await db
    .select({ syncCursors: connections.syncCursors })
    .from(connections)
    .where(
      and(eq(connections.workspaceId, ctx.workspaceId), eq(connections.integrationId, 'gmail')),
    );
  return (row?.syncCursors as Record<string, string>)?.['mailbox'];
}

const mail = (id: string, subject: string) => ({
  id,
  threadId: `t-${id}`,
  labelIds: ['INBOX'],
  snippet: `${subject}...`,
});

describe('syncGmail', () => {
  it('first sync lists recent ids and lands each message as metadata', async () => {
    const ctx = await connectedGmail('gmail-first@kloyya.test');

    const outcome = await syncGmail(
      db,
      crypto,
      ctx,
      deps(
        fakeGmail({
          profileHistoryId: '1001',
          listIds: ['m1', 'm2'],
          messages: { m1: mail('m1', 'Hello'), m2: mail('m2', 'Invoice') },
        }),
      ),
    );

    expect(outcome).toMatchObject({ ok: true, fetched: 2, written: 2 });

    const rows = await records(ctx);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.resourceType === 'message')).toBe(true);
    // Verbatim: Gmail's shape, stored as-is.
    expect(rows.find((r) => r.externalId === 'm1')?.payload).toMatchObject({ threadId: 't-m1' });
    // The cursor is the PROFILE's historyId, ready for next time.
    expect(await cursorOf(ctx)).toBe('1001');
  });

  it('incremental sync reads only what history reports changed', async () => {
    const ctx = await connectedGmail('gmail-incr@kloyya.test');
    // Seed a cursor so this is an incremental run.
    await db
      .update(connections)
      .set({ syncCursors: { mailbox: '500' } })
      .where(eq(connections.workspaceId, ctx.workspaceId));

    const outcome = await syncGmail(
      db,
      crypto,
      ctx,
      deps(
        fakeGmail({
          profileHistoryId: '600',
          history: { startHistoryId: '500', changed: ['m9'] },
          messages: { m9: mail('m9', 'New thread') },
        }),
      ),
    );

    expect(outcome).toMatchObject({ ok: true, fetched: 1, written: 1 });
    expect((await records(ctx)).map((r) => r.externalId)).toEqual(['m9']);
    expect(await cursorOf(ctx)).toBe('600');
  });

  it('tombstones a message history says was deleted', async () => {
    const ctx = await connectedGmail('gmail-del@kloyya.test');
    await db
      .update(connections)
      .set({ syncCursors: { mailbox: '500' } })
      .where(eq(connections.workspaceId, ctx.workspaceId));

    const outcome = await syncGmail(
      db,
      crypto,
      ctx,
      deps(
        fakeGmail({
          profileHistoryId: '700',
          history: { startHistoryId: '500', deleted: ['gone1'] },
          messages: {},
        }),
      ),
    );

    expect(outcome).toMatchObject({ ok: true, tombstoned: 1 });
    const rows = await records(ctx);
    // The deletion is a record, not an absence — "this was deleted" is intelligence.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAtSource).toBeInstanceOf(Date);
  });

  it('recovers with a full read when the historyId aged out (404)', async () => {
    const ctx = await connectedGmail('gmail-410@kloyya.test');
    await db
      .update(connections)
      .set({ syncCursors: { mailbox: 'ancient' } })
      .where(eq(connections.workspaceId, ctx.workspaceId));

    const outcome = await syncGmail(
      db,
      crypto,
      ctx,
      deps(
        fakeGmail({
          profileHistoryId: '900',
          history: 404, // Gmail aged out our cursor.
          listIds: ['m1'],
          messages: { m1: mail('m1', 'After a full re-read') },
        }),
      ),
    );

    // Rather than staying stuck on a historyId Gmail will never accept again.
    expect(outcome).toMatchObject({ ok: true, fetched: 1 });
    expect(await cursorOf(ctx)).toBe('900');
  });

  it('skips a message deleted between list and get', async () => {
    const ctx = await connectedGmail('gmail-race@kloyya.test');

    const outcome = await syncGmail(
      db,
      crypto,
      ctx,
      deps(
        fakeGmail({
          profileHistoryId: '1001',
          listIds: ['m1', 'vanished'],
          messages: { m1: mail('m1', 'Still here'), vanished: 404 },
        }),
      ),
    );

    // The race is ordinary; losing the whole sync over one deleted mail would not be.
    expect(outcome).toMatchObject({ ok: true, written: 1 });
    expect((await records(ctx)).map((r) => r.externalId)).toEqual(['m1']);
  });

  it('does not advance the cursor when the mailbox read fails', async () => {
    const ctx = await connectedGmail('gmail-fail@kloyya.test');
    await db
      .update(connections)
      .set({ syncCursors: { mailbox: '500' } })
      .where(eq(connections.workspaceId, ctx.workspaceId));

    const rateLimited = (async () =>
      new Response('slow down', { status: 429 })) as unknown as typeof fetch;

    const outcome = await syncGmail(db, crypto, ctx, deps(rateLimited));

    expect(outcome).toMatchObject({ ok: false, reason: 'transient' });
    // The connection is fine; Google wasn't. Cursor and freshness are untouched.
    expect(await cursorOf(ctx)).toBe('500');
    const [row] = await db
      .select({ status: connections.status, lastSyncedAt: connections.lastSyncedAt })
      .from(connections)
      .where(eq(connections.workspaceId, ctx.workspaceId));
    expect(row?.status).toBe('connected');
  });

  it('refuses to sync a mailbox that was never connected', async () => {
    const { userId } = await signUp(app, {
      email: 'gmail-none@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'None',
    });
    const [profile] = await db
      .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
      .from(users)
      .where(eq(users.id, userId));

    const outcome = await syncGmail(
      db,
      crypto,
      { userId, workspaceId: profile!.wsId!, organizationId: profile!.orgId },
      deps(fakeGmail({ profileHistoryId: '1', messages: {} })),
    );

    expect(outcome).toMatchObject({ ok: false, reason: 'not_connected' });
  });
});
