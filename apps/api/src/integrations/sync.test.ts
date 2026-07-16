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
import { syncGoogleCalendar } from './sync.js';

/**
 * The Google Calendar sync.
 *
 * A fake Google stands in for the real one, so the tests can assert the things
 * that actually go wrong in connectors: a re-sync that rewrites everything, a
 * cursor that never advances, a cancelled meeting that disappears instead of
 * being recorded, and a rate limit that gets mistaken for a broken connection.
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

/** A fake Google: one calendar, scripted event pages. */
function fakeGoogle(script: {
  calendars?: { id: string; summary: string }[];
  pages: Record<string, unknown>;
  onEvents?: (url: URL) => void;
}): typeof fetch {
  const calendars = script.calendars ?? [{ id: 'primary', summary: 'Primary' }];
  return (async (input: string | URL) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());

    if (url.pathname.endsWith('/users/me/calendarList')) {
      return new Response(JSON.stringify({ items: calendars }), { status: 200 });
    }
    if (url.pathname.includes('/events')) {
      script.onEvents?.(url);
      const key = url.searchParams.get('syncToken') ?? 'full';
      const page = script.pages[key];
      if (page === 410) return new Response('gone', { status: 410 });
      if (page === 429) return new Response('slow down', { status: 429 });
      return new Response(JSON.stringify(page ?? { items: [] }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
}

/** A connected Google Calendar with a live (non-expired) access token. */
async function connected(email: string): Promise<StartContext> {
  const { userId } = await signUp(app, {
    email,
    password: 'a sufficiently long passphrase',
    name: 'Calendar Owner',
  });
  const [profile] = await db
    .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
    .from(users)
    .where(eq(users.id, userId));

  await db.insert(connections).values({
    organizationId: profile!.orgId,
    workspaceId: profile!.wsId!,
    integrationId: 'google_calendar',
    status: 'connected',
    accessTokenEnc: crypto.encrypt('a-live-access-token'),
    refreshTokenEnc: crypto.encrypt('a-refresh-token'),
    accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    grantedScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });

  return { userId, workspaceId: profile!.wsId!, organizationId: profile!.orgId };
}

async function records(ctx: StartContext) {
  return db
    .select({
      externalId: syncRecords.externalId,
      payload: syncRecords.payload,
      deletedAtSource: syncRecords.deletedAtSource,
      contentHash: syncRecords.contentHash,
      resourceType: syncRecords.resourceType,
    })
    .from(syncRecords)
    .where(eq(syncRecords.workspaceId, ctx.workspaceId));
}

async function connectionRow(ctx: StartContext) {
  const [row] = await db
    .select({
      status: connections.status,
      lastSyncedAt: connections.lastSyncedAt,
      syncCursors: connections.syncCursors,
      errorReason: connections.errorReason,
    })
    .from(connections)
    .where(
      and(
        eq(connections.workspaceId, ctx.workspaceId),
        eq(connections.integrationId, 'google_calendar'),
      ),
    );
  return row;
}

const meeting = (id: string, summary: string) => ({
  id,
  summary,
  status: 'confirmed',
  start: { dateTime: '2026-02-01T10:00:00Z' },
  attendees: [{ email: 'someone@example.com' }],
});

describe('syncGoogleCalendar', () => {
  it('lands raw events verbatim and records the cursor', async () => {
    const ctx = await connected('sync-basic@kloyya.test');

    const outcome = await syncGoogleCalendar(
      db,
      crypto,
      ctx,
      deps(
        fakeGoogle({
          pages: { full: { items: [meeting('e1', 'Standup'), meeting('e2', 'Review')], nextSyncToken: 'tok-1' } },
        }),
      ),
    );

    expect(outcome).toMatchObject({ ok: true, fetched: 2, written: 2, tombstoned: 0 });

    const rows = await records(ctx);
    expect(rows).toHaveLength(2);
    // Verbatim: Google's shape, not ours. No summarising, no scoring.
    const standup = rows.find((r) => r.externalId === 'e1');
    expect(standup?.payload).toMatchObject({ summary: 'Standup', status: 'confirmed' });
    expect(standup?.resourceType).toBe('calendar_event');

    const row = await connectionRow(ctx);
    expect((row?.syncCursors as Record<string, string>)['primary']).toBe('tok-1');
    expect(row?.status).toBe('connected');
    expect(row?.lastSyncedAt).toBeInstanceOf(Date);
  });

  it('skips unchanged events on a re-sync', async () => {
    const ctx = await connected('sync-unchanged@kloyya.test');
    const google = fakeGoogle({
      pages: { full: { items: [meeting('e1', 'Standup')], nextSyncToken: 'tok-1' } },
    });

    await syncGoogleCalendar(db, crypto, ctx, deps(google));

    // Google re-sends the identical object; rewriting it would churn the table
    // and wake the pipeline for nothing.
    const second = await syncGoogleCalendar(
      db,
      crypto,
      ctx,
      deps(fakeGoogle({ pages: { 'tok-1': { items: [meeting('e1', 'Standup')], nextSyncToken: 'tok-2' } } })),
    );

    expect(second).toMatchObject({ ok: true, fetched: 1, written: 0 });
    expect(await records(ctx)).toHaveLength(1);
  });

  it('writes an event that actually changed', async () => {
    const ctx = await connected('sync-changed@kloyya.test');
    await syncGoogleCalendar(
      db,
      crypto,
      ctx,
      deps(fakeGoogle({ pages: { full: { items: [meeting('e1', 'Standup')], nextSyncToken: 'tok-1' } } })),
    );

    const second = await syncGoogleCalendar(
      db,
      crypto,
      ctx,
      deps(
        fakeGoogle({
          pages: { 'tok-1': { items: [meeting('e1', 'Standup — moved')], nextSyncToken: 'tok-2' } },
        }),
      ),
    );

    expect(second).toMatchObject({ ok: true, written: 1 });
    const rows = await records(ctx);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toMatchObject({ summary: 'Standup — moved' });
  });

  it('tombstones a cancelled meeting rather than deleting it', async () => {
    const ctx = await connected('sync-cancel@kloyya.test');
    await syncGoogleCalendar(
      db,
      crypto,
      ctx,
      deps(fakeGoogle({ pages: { full: { items: [meeting('e1', 'Standup')], nextSyncToken: 'tok-1' } } })),
    );

    const second = await syncGoogleCalendar(
      db,
      crypto,
      ctx,
      deps(
        fakeGoogle({
          pages: { 'tok-1': { items: [{ id: 'e1', status: 'cancelled' }], nextSyncToken: 'tok-2' } },
        }),
      ),
    );

    expect(second).toMatchObject({ ok: true, tombstoned: 1 });
    const rows = await records(ctx);
    // "This meeting was cancelled" is intelligence. A row that vanished couldn't
    // tell the pipeline anything.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAtSource).toBeInstanceOf(Date);
  });

  it('re-reads in full when Google expires the sync token', async () => {
    const ctx = await connected('sync-410@kloyya.test');
    await syncGoogleCalendar(
      db,
      crypto,
      ctx,
      deps(fakeGoogle({ pages: { full: { items: [meeting('e1', 'Old')], nextSyncToken: 'stale' } } })),
    );

    // 410 on the stale token, then a successful full read.
    const outcome = await syncGoogleCalendar(
      db,
      crypto,
      ctx,
      deps(
        fakeGoogle({
          pages: {
            stale: 410,
            full: { items: [meeting('e1', 'Old'), meeting('e2', 'New')], nextSyncToken: 'tok-fresh' },
          },
        }),
      ),
    );

    // Recovering rather than staying stuck on a cursor Google will never accept.
    expect(outcome).toMatchObject({ ok: true, fetched: 2 });
    const row = await connectionRow(ctx);
    expect((row?.syncCursors as Record<string, string>)['primary']).toBe('tok-fresh');
  });

  it('keeps the connection healthy when Google rate-limits', async () => {
    const ctx = await connected('sync-429@kloyya.test');

    const outcome = await syncGoogleCalendar(
      db,
      crypto,
      ctx,
      deps(fakeGoogle({ pages: { full: 429 } })),
    );

    expect(outcome).toMatchObject({ ok: false, reason: 'transient' });

    const row = await connectionRow(ctx);
    // A rate limit is not a broken connection, and not something a user can fix.
    expect(row?.status).toBe('connected');
    expect(row?.errorReason).toBeNull();
    // And it must not claim freshness it didn't achieve.
    expect(row?.lastSyncedAt).toBeNull();
  });

  it('does not advance lastSyncedAt when the sync failed', async () => {
    const ctx = await connected('sync-freshness@kloyya.test');

    await syncGoogleCalendar(db, crypto, ctx, deps(fakeGoogle({ pages: { full: 429 } })));

    // "Your data is current as of…" must never be said when it isn't true.
    expect((await connectionRow(ctx))?.lastSyncedAt).toBeNull();
  });

  it('syncs every calendar, each with its own cursor', async () => {
    const ctx = await connected('sync-multi@kloyya.test');
    const seen: string[] = [];

    const outcome = await syncGoogleCalendar(
      db,
      crypto,
      ctx,
      deps(
        fakeGoogle({
          calendars: [
            { id: 'primary', summary: 'Primary' },
            { id: 'team@group.calendar.google.com', summary: 'Team' },
          ],
          pages: { full: { items: [meeting('e1', 'One')], nextSyncToken: 'tok-x' } },
          onEvents: (url) => seen.push(decodeURIComponent(url.pathname)),
        }),
      ),
    );

    expect(outcome.ok).toBe(true);
    // A single cursor column would have silently synced only one of these.
    expect(seen.some((p) => p.includes('primary'))).toBe(true);
    expect(seen.some((p) => p.includes('team@group.calendar.google.com'))).toBe(true);

    const cursors = (await connectionRow(ctx))?.syncCursors as Record<string, string>;
    expect(Object.keys(cursors).sort()).toEqual(['primary', 'team@group.calendar.google.com']);
  });

  it('refuses to sync an integration that was never connected', async () => {
    const { userId } = await signUp(app, {
      email: 'sync-none@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'None',
    });
    const [profile] = await db
      .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
      .from(users)
      .where(eq(users.id, userId));

    const outcome = await syncGoogleCalendar(
      db,
      crypto,
      { userId, workspaceId: profile!.wsId!, organizationId: profile!.orgId },
      deps(fakeGoogle({ pages: {} })),
    );

    expect(outcome).toMatchObject({ ok: false, reason: 'not_connected' });
  });

  it('parks the connection when the user revoked access mid-sync', async () => {
    const ctx = await connected('sync-revoked@kloyya.test');
    // Force a refresh by expiring the access token.
    await db
      .update(connections)
      .set({ accessTokenExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(connections.workspaceId, ctx.workspaceId));

    const revokingGoogle = (async (input: string | URL) => {
      const url = new URL(typeof input === 'string' ? input : input.toString());
      if (url.pathname.includes('/token')) {
        return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    const outcome = await syncGoogleCalendar(db, crypto, ctx, deps(revokingGoogle));

    expect(outcome).toMatchObject({ ok: false, reason: 'revoked' });
    const row = await connectionRow(ctx);
    expect(row?.status).toBe('error');
    expect(row?.errorReason).toMatch(/revoked|Reconnect/i);
  });
});
