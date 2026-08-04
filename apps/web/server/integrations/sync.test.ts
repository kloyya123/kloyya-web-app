import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppDb } from '@kloyya/db/client';
import { connections, syncRecords } from '@kloyya/db/schema';
import { withTenantScope } from '@kloyya/db/scope';
import { createTestDb, createTestIdentity, startContextFor } from '../test/harness';
import type { StartContext } from '../tenant';
import { createTokenCrypto } from '../crypto/tokens';
import { landRecords, syncGoogleCalendar, syncSlack, type RecordToLand } from './sync';

/**
 * The batched write this file exists to protect.
 *
 * `landRecords` replaced a per-object SELECT-then-INSERT — roughly two
 * sequential round trips per record — with one `INSERT ... ON CONFLICT DO
 * UPDATE ... WHERE` per chunk. The tests below are not about speed (nothing
 * here can observe a round-trip count); they are about proving the batched
 * statement kept every behaviour the slow version had: skip what has not
 * changed, rewrite what has, flip a tombstone, and never let one workspace's
 * write touch another's rows.
 */

async function insertConnection(
  db: AppDb,
  ctx: StartContext,
  integrationId: string,
): Promise<string> {
  return withTenantScope(db, ctx.organizationId, async (tx) => {
    const [row] = await tx
      .insert(connections)
      .values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        integrationId,
        status: 'connected',
        connectedByUserId: ctx.userId,
      })
      .returning({ id: connections.id });
    return row!.id;
  });
}

async function recordsFor(
  db: AppDb,
  ctx: StartContext,
  connectionId: string,
): Promise<{ externalId: string; contentHash: string; deletedAtSource: Date | null }[]> {
  return withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select({
        externalId: syncRecords.externalId,
        contentHash: syncRecords.contentHash,
        deletedAtSource: syncRecords.deletedAtSource,
      })
      .from(syncRecords)
      .where(eq(syncRecords.connectionId, connectionId)),
  );
}

describe('landRecords', () => {
  let db: AppDb;
  let ctx: StartContext;
  let connectionId: string;
  const now = new Date('2026-08-03T09:00:00.000Z');

  beforeEach(async () => {
    ({ db } = await createTestDb());
    const identity = await createTestIdentity(db, { email: 'owner@example.com' });
    ctx = await startContextFor(db, identity);
    connectionId = await insertConnection(db, ctx, 'gmail');
  });

  it('does nothing and touches the database not at all on an empty page', async () => {
    const result = await landRecords(db, ctx, connectionId, 'gmail', [], now);
    expect(result).toEqual({ written: 0, tombstoned: 0 });
  });

  it('writes a genuinely new record', async () => {
    const result = await landRecords(
      db,
      ctx,
      connectionId,
      'gmail',
      [{ resourceType: 'message', externalId: 'm1', payload: { subject: 'Hi' }, cancelled: false }],
      now,
    );
    expect(result).toEqual({ written: 1, tombstoned: 0 });

    const rows = await recordsFor(db, ctx, connectionId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.externalId).toBe('m1');
    expect(rows[0]?.deletedAtSource).toBeNull();
  });

  it('skips a record whose payload has not changed', async () => {
    const record: RecordToLand = {
      resourceType: 'message',
      externalId: 'm1',
      payload: { subject: 'Hi' },
      cancelled: false,
    };

    const first = await landRecords(db, ctx, connectionId, 'gmail', [record], now);
    expect(first.written).toBe(1);

    // The exact case the old SELECT-then-INSERT existed to catch: a provider
    // re-sending an object that has not actually changed must not rewrite the
    // row. Here it is the WHERE clause on the upsert deciding that, not a
    // query we ran ourselves first.
    const second = await landRecords(db, ctx, connectionId, 'gmail', [record], now);
    expect(second).toEqual({ written: 0, tombstoned: 0 });
  });

  it('rewrites a record when its payload changes', async () => {
    const base = { resourceType: 'message', externalId: 'm1', cancelled: false };
    await landRecords(db, ctx, connectionId, 'gmail', [{ ...base, payload: { subject: 'v1' } }], now);

    const second = await landRecords(
      db,
      ctx,
      connectionId,
      'gmail',
      [{ ...base, payload: { subject: 'v2' } }],
      now,
    );
    expect(second.written).toBe(1);

    const rows = await recordsFor(db, ctx, connectionId);
    expect(rows).toHaveLength(1); // still one row — an upsert, not a second insert
  });

  it('rewrites and counts a tombstone flip even when the payload is identical', async () => {
    const payload = { subject: 'Hi' };
    await landRecords(
      db,
      ctx,
      connectionId,
      'gmail',
      [{ resourceType: 'message', externalId: 'm1', payload, cancelled: false }],
      now,
    );

    // Same content, but the provider now reports it gone. This must still count
    // as written — the tombstone itself is the change, and skipping it would
    // silently keep a deleted message live in the pipeline's view forever.
    const result = await landRecords(
      db,
      ctx,
      connectionId,
      'gmail',
      [{ resourceType: 'message', externalId: 'm1', payload, cancelled: true }],
      now,
    );
    expect(result).toEqual({ written: 1, tombstoned: 1 });

    const rows = await recordsFor(db, ctx, connectionId);
    expect(rows[0]?.deletedAtSource).not.toBeNull();
  });

  it('re-landing a live record clears an existing tombstone', async () => {
    const payload = { subject: 'Hi' };
    await landRecords(
      db,
      ctx,
      connectionId,
      'gmail',
      [{ resourceType: 'message', externalId: 'm1', payload, cancelled: true }],
      now,
    );

    const result = await landRecords(
      db,
      ctx,
      connectionId,
      'gmail',
      [{ resourceType: 'message', externalId: 'm1', payload, cancelled: false }],
      now,
    );
    expect(result.written).toBe(1);

    const rows = await recordsFor(db, ctx, connectionId);
    expect(rows[0]?.deletedAtSource).toBeNull();
  });

  it('de-dupes a page that repeats the same object, keeping the last one', async () => {
    // A single INSERT cannot touch the same conflict target twice — Postgres
    // raises "ON CONFLICT DO UPDATE command cannot affect row a second time".
    // Rather than trust every provider page to be internally unique, the same
    // (resourceType, externalId) landing twice in one call must not throw, and
    // must resolve to whichever version was listed last.
    const result = await landRecords(
      db,
      ctx,
      connectionId,
      'gmail',
      [
        { resourceType: 'message', externalId: 'm1', payload: { subject: 'stale' }, cancelled: false },
        { resourceType: 'message', externalId: 'm1', payload: { subject: 'fresh' }, cancelled: false },
      ],
      now,
    );

    expect(result.written).toBe(1);
    const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
      tx
        .select({ payload: syncRecords.payload })
        .from(syncRecords)
        .where(eq(syncRecords.connectionId, connectionId)),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toEqual({ subject: 'fresh' });
  });

  it('writes a batch larger than one chunk in a single call', async () => {
    // Chunking is an internal detail (LAND_CHUNK_SIZE), but a first sync on a
    // busy mailbox is exactly the case it exists for — prove a batch that
    // spans more than one chunk lands completely rather than silently
    // truncating at the boundary.
    const records: RecordToLand[] = Array.from({ length: 1_200 }, (_, i) => ({
      resourceType: 'message',
      externalId: `m${i}`,
      payload: { subject: `message ${i}` },
      cancelled: false,
    }));

    const result = await landRecords(db, ctx, connectionId, 'gmail', records, now);
    expect(result).toEqual({ written: 1_200, tombstoned: 0 });

    const rows = await recordsFor(db, ctx, connectionId);
    expect(rows).toHaveLength(1_200);
  });

  it('never lets one workspace write or see another workspace’s records', async () => {
    const otherIdentity = await createTestIdentity(db, { email: 'other@example.com' });
    const otherCtx = await startContextFor(db, otherIdentity);
    const otherConnectionId = await insertConnection(db, otherCtx, 'gmail');

    await landRecords(
      db,
      ctx,
      connectionId,
      'gmail',
      [{ resourceType: 'message', externalId: 'shared-id', payload: { subject: 'mine' }, cancelled: false }],
      now,
    );
    await landRecords(
      db,
      otherCtx,
      otherConnectionId,
      'gmail',
      [{ resourceType: 'message', externalId: 'shared-id', payload: { subject: 'theirs' }, cancelled: false }],
      now,
    );

    // Same externalId, same resourceType, different workspace — the unique
    // index includes connectionId precisely so this is two rows, not one.
    const mine = await recordsFor(db, ctx, connectionId);
    const theirs = await recordsFor(db, otherCtx, otherConnectionId);
    expect(mine).toHaveLength(1);
    expect(theirs).toHaveLength(1);

    // And RLS is the actual backstop, not just the WHERE clause above: reading
    // the other tenant's connection under THIS tenant's scope must come back
    // empty rather than erroring or leaking a row.
    const crossTenantRead = await withTenantScope(db, ctx.organizationId, async (tx) =>
      tx.select().from(syncRecords).where(eq(syncRecords.connectionId, otherConnectionId)),
    );
    expect(crossTenantRead).toEqual([]);
  });
});

describe('syncGoogleCalendar, end to end through the batched write', () => {
  let db: AppDb;
  let ctx: StartContext;
  let crypto: ReturnType<typeof createTokenCrypto>;
  const now = new Date('2026-08-03T09:00:00.000Z');

  const CALENDAR_ID = 'primary';
  // Live events carry a real start/end: validateCalendarEvents rejects a
  // non-cancelled event without a usable start, so fixtures missing one would
  // never reach the write and this test would prove nothing about batching.
  // The cancelled event deliberately has neither — Google sends tombstones as
  // little more than an id and a status, and the validator allows exactly that.
  const events = [
    {
      id: 'evt1',
      status: 'confirmed',
      summary: 'Standup',
      start: { dateTime: '2026-08-03T09:30:00Z' },
      end: { dateTime: '2026-08-03T09:45:00Z' },
    },
    {
      id: 'evt2',
      status: 'confirmed',
      summary: 'Board sync',
      start: { dateTime: '2026-08-03T14:00:00Z' },
      end: { dateTime: '2026-08-03T15:00:00Z' },
    },
    { id: 'evt3', status: 'cancelled', summary: 'Cancelled 1:1' },
  ];

  function fetchImpl(): typeof fetch {
    return (async (url: string | URL) => {
      const href = String(url);
      if (href.includes('/calendarList')) {
        return new Response(
          JSON.stringify({ items: [{ id: CALENDAR_ID, summary: 'Primary' }] }),
          { status: 200 },
        );
      }
      if (href.includes('/events')) {
        return new Response(JSON.stringify({ items: events, nextSyncToken: 'token-1' }), {
          status: 200,
        });
      }
      throw new Error(`unexpected request: ${href}`);
    }) as unknown as typeof fetch;
  }

  beforeEach(async () => {
    ({ db } = await createTestDb());
    const identity = await createTestIdentity(db, { email: 'owner@example.com' });
    ctx = await startContextFor(db, identity);
    crypto = createTokenCrypto(randomBytes(32).toString('base64'));

    await withTenantScope(db, ctx.organizationId, async (tx) => {
      await tx.insert(connections).values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        integrationId: 'google_calendar',
        status: 'connected',
        connectedByUserId: ctx.userId,
        accessTokenEnc: crypto.encrypt('test-access-token'),
        refreshTokenEnc: crypto.encrypt('test-refresh-token'),
        // Far enough out that getValidAccessToken serves it straight from
        // storage — no refresh call, so the stub fetchImpl only ever has to
        // answer the Calendar API itself.
        accessTokenExpiresAt: new Date(now.getTime() + 3_600_000),
      });
    });
  });

  it('lands a full page in one write, correctly separating live events from a tombstone', async () => {
    const outcome = await syncGoogleCalendar(db, crypto, ctx, {
      clientId: 'client',
      clientSecret: 'secret',
      fetchImpl: fetchImpl(),
      now: () => now.getTime(),
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.fetched).toBe(3);
    expect(outcome.written).toBe(3);
    expect(outcome.tombstoned).toBe(1);

    const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
      tx.select().from(syncRecords).where(eq(syncRecords.resourceType, 'calendar_event')),
    );
    expect(rows).toHaveLength(3);
    const cancelled = rows.find((r) => r.externalId === 'evt3');
    expect(cancelled?.deletedAtSource).not.toBeNull();
  });

  it('a second run with identical data writes nothing', async () => {
    const deps = {
      clientId: 'client',
      clientSecret: 'secret',
      now: () => now.getTime(),
    };

    await syncGoogleCalendar(db, crypto, ctx, { ...deps, fetchImpl: fetchImpl() });
    // Same calendar, same events, same statuses — nothing for the batched
    // write to do. This is the property the whole refactor exists to keep: an
    // unchanged re-sync should cost a read, not a rewrite of every row.
    const second = await syncGoogleCalendar(db, crypto, ctx, { ...deps, fetchImpl: fetchImpl() });

    expect(second.ok).toBe(true);
    expect(second.written).toBe(0);
    expect(second.tombstoned).toBe(0);
  });
});

describe('syncSlack, end to end through the batched write', () => {
  let db: AppDb;
  let ctx: StartContext;
  let crypto: ReturnType<typeof createTokenCrypto>;
  // Deliberately NOT a fixed historical Date, unlike the other describe blocks
  // above: fetchWithBudget's deadline is compared against the real wall clock
  // (Date.now()), not against `deps.now()` — so a frozen past "now" here would
  // make the deadline already expired before the first conversation is even
  // read, truncating every run to zero fetches. Production never overrides
  // `now`, so this mismatch is a test-only concern; real time sidesteps it.

  const CONVERSATIONS = [{ id: 'C1', name: 'general' }, { id: 'C2', name: 'eng' }];
  const messagesFor = (channel: string) => {
    if (channel === 'C1') {
      return [
        { type: 'message', user: 'U1', text: 'Ship it', ts: '1722675000.000100' },
        // A system message — landed nowhere, since it isn't conversation content.
        { type: 'message', subtype: 'channel_join', user: 'U2', ts: '1722675001.000100' },
      ];
    }
    return [{ type: 'message', user: 'U3', text: 'Build is green', ts: '1722675002.000100' }];
  };

  function fetchImpl(): typeof fetch {
    return (async (url: string | URL) => {
      const href = String(url);
      if (href.includes('conversations.list')) {
        return new Response(JSON.stringify({ ok: true, channels: CONVERSATIONS }), { status: 200 });
      }
      if (href.includes('conversations.history')) {
        const channel = new URL(href).searchParams.get('channel')!;
        return new Response(
          JSON.stringify({ ok: true, messages: messagesFor(channel), has_more: false }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected request: ${href}`);
    }) as unknown as typeof fetch;
  }

  beforeEach(async () => {
    ({ db } = await createTestDb());
    const identity = await createTestIdentity(db, { email: 'owner@example.com' });
    ctx = await startContextFor(db, identity);
    crypto = createTokenCrypto(randomBytes(32).toString('base64'));

    await withTenantScope(db, ctx.organizationId, async (tx) => {
      await tx.insert(connections).values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        integrationId: 'slack',
        status: 'connected',
        connectedByUserId: ctx.userId,
        // A bot token, like Notion's: no refresh token, no expiry to track.
        accessTokenEnc: crypto.encrypt('xoxb-test-token'),
      });
    });
  });

  it('lands messages from every conversation the bot can read, skipping system subtypes', async () => {
    const outcome = await syncSlack(db, crypto, ctx, {
      clientId: '',
      clientSecret: '',
      fetchImpl: fetchImpl(),
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.fetched).toBe(3);
    expect(outcome.written).toBe(2); // The channel_join subtype never reaches landRecords.

    const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
      tx.select().from(syncRecords).where(eq(syncRecords.resourceType, 'slack_message')),
    );
    expect(rows.map((r) => r.externalId).sort()).toEqual([
      'C1:1722675000.000100',
      'C2:1722675002.000100',
    ]);
    // The composite key means the same ts in two different channels can't collide.
    const generalMessage = rows.find((r) => r.externalId === 'C1:1722675000.000100');
    expect((generalMessage?.payload as { channelName: string }).channelName).toBe('general');
  });

  it('a second run with identical data writes nothing', async () => {
    const deps = { clientId: '', clientSecret: '' };
    await syncSlack(db, crypto, ctx, { ...deps, fetchImpl: fetchImpl() });
    const second = await syncSlack(db, crypto, ctx, { ...deps, fetchImpl: fetchImpl() });

    expect(second.ok).toBe(true);
    expect(second.written).toBe(0);
  });

  it('reports revoked when Slack refuses the token', async () => {
    const revokedFetch = (async () =>
      new Response(JSON.stringify({ ok: false, error: 'token_revoked' }), { status: 200 })) as unknown as typeof fetch;

    const outcome = await syncSlack(db, crypto, ctx, {
      clientId: '',
      clientSecret: '',
      fetchImpl: revokedFetch,
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toBe('revoked');

    const [connection] = await withTenantScope(db, ctx.organizationId, async (tx) =>
      tx.select().from(connections).where(eq(connections.integrationId, 'slack')),
    );
    expect(connection?.status).toBe('error');
  });
});
