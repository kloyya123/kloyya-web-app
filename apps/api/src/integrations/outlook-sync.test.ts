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
import { syncOutlookCalendar, syncOutlookMail } from './sync.js';

/**
 * The Outlook connectors (mail + calendar) over Microsoft Graph delta.
 *
 * A fake Graph stands in. The cases that matter are the ones the delta model
 * gets wrong: capturing the deltaLink as the cursor, tombstoning an @removed
 * item, recovering from a 410, and — the Microsoft-specific one — refreshing on
 * a rotated refresh token rather than Google's flow.
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
 * A fake Graph. `delta` is keyed by an incoming deltaLink (or 'first' for the
 * initial request); `token` scripts the refresh endpoint.
 */
function fakeGraph(script: {
  delta?: Record<string, unknown | number>;
  first?: unknown | number;
  token?: unknown;
}): typeof fetch {
  return (async (input: string | URL) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());

    if (url.host.includes('login.microsoftonline.com')) {
      return new Response(JSON.stringify(script.token ?? { access_token: 'refreshed', expires_in: 3600 }), {
        status: 200,
      });
    }
    // A saved deltaLink is replayed verbatim; the first request has none.
    const key = url.searchParams.get('$deltatoken') ?? (url.href.includes('cursor=') ? url.searchParams.get('cursor') : null);
    const page = key ? script.delta?.[key] : (script.first ?? { value: [], '@odata.deltaLink': makeDelta('c1') });
    const resolved = page ?? { value: [], '@odata.deltaLink': makeDelta('c1') };
    if (resolved === 410) return new Response('gone', { status: 410 });
    if (resolved === 429) return new Response('slow', { status: 429 });
    return new Response(JSON.stringify(resolved), { status: 200 });
  }) as unknown as typeof fetch;
}

/** A deltaLink URL our fake recognizes by its `cursor` query param. */
function makeDelta(id: string): string {
  return `https://graph.microsoft.com/v1.0/me/messages/delta?cursor=${id}`;
}

async function connected(email: string, integrationId: 'outlook' | 'outlook_calendar'): Promise<StartContext> {
  const { userId } = await signUp(app, {
    email,
    password: 'a sufficiently long passphrase',
    name: 'Outlook Owner',
  });
  const [profile] = await db
    .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
    .from(users)
    .where(eq(users.id, userId));

  await db.insert(connections).values({
    organizationId: profile!.orgId,
    workspaceId: profile!.wsId!,
    integrationId,
    status: 'connected',
    accessTokenEnc: crypto.encrypt('a-live-access-token'),
    refreshTokenEnc: crypto.encrypt('a-refresh-token'),
    accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    grantedScopes: ['https://graph.microsoft.com/Mail.Read'],
  });

  return { userId, workspaceId: profile!.wsId!, organizationId: profile!.orgId };
}

async function records(ctx: StartContext) {
  return db
    .select({
      externalId: syncRecords.externalId,
      payload: syncRecords.payload,
      deletedAtSource: syncRecords.deletedAtSource,
      resourceType: syncRecords.resourceType,
    })
    .from(syncRecords)
    .where(eq(syncRecords.workspaceId, ctx.workspaceId));
}

async function cursorFor(ctx: StartContext, integrationId: string) {
  const [row] = await db
    .select({ syncCursors: connections.syncCursors })
    .from(connections)
    .where(and(eq(connections.workspaceId, ctx.workspaceId), eq(connections.integrationId, integrationId)));
  return (row?.syncCursors as Record<string, string>)['delta'];
}

describe('syncOutlookMail', () => {
  it('lands mail verbatim and records the deltaLink cursor', async () => {
    const ctx = await connected('outlook-basic@kloyya.test', 'outlook');

    const outcome = await syncOutlookMail(
      db,
      crypto,
      ctx,
      deps(
        fakeGraph({
          first: {
            value: [
              { id: 'm1', subject: 'Standup notes' },
              { id: 'm2', subject: 'Invoice' },
            ],
            '@odata.deltaLink': makeDelta('after-first'),
          },
        }),
      ),
    );

    expect(outcome).toMatchObject({ ok: true, fetched: 2, written: 2, tombstoned: 0 });
    const rows = await records(ctx);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.externalId === 'm1')?.payload).toMatchObject({ subject: 'Standup notes' });
    expect(rows[0]?.resourceType).toBe('message');
    expect(await cursorFor(ctx, 'outlook')).toBe(makeDelta('after-first'));
  });

  it('tombstones a removed message rather than dropping it', async () => {
    const ctx = await connected('outlook-removed@kloyya.test', 'outlook');
    await syncOutlookMail(
      db,
      crypto,
      ctx,
      deps(fakeGraph({ first: { value: [{ id: 'm1', subject: 'Doomed' }], '@odata.deltaLink': makeDelta('c-a') } })),
    );

    const outcome = await syncOutlookMail(
      db,
      crypto,
      ctx,
      deps(
        fakeGraph({
          delta: {
            'c-a': { value: [{ id: 'm1', '@removed': { reason: 'deleted' } }], '@odata.deltaLink': makeDelta('c-b') },
          },
        }),
      ),
    );

    expect(outcome).toMatchObject({ ok: true, tombstoned: 1 });
    const rows = await records(ctx);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAtSource).toBeInstanceOf(Date);
  });

  it('recovers with a full read when the deltaLink expires (410)', async () => {
    const ctx = await connected('outlook-410@kloyya.test', 'outlook');
    await syncOutlookMail(
      db,
      crypto,
      ctx,
      deps(fakeGraph({ first: { value: [{ id: 'm1', subject: 'Old' }], '@odata.deltaLink': makeDelta('stale') } })),
    );

    const outcome = await syncOutlookMail(
      db,
      crypto,
      ctx,
      deps(
        fakeGraph({
          delta: { stale: 410 },
          first: {
            value: [
              { id: 'm1', subject: 'Old' },
              { id: 'm2', subject: 'New' },
            ],
            '@odata.deltaLink': makeDelta('fresh'),
          },
        }),
      ),
    );

    expect(outcome.ok).toBe(true);
    expect(await cursorFor(ctx, 'outlook')).toBe(makeDelta('fresh'));
    expect(await records(ctx)).toHaveLength(2);
  });

  it('refreshes on Microsoft’s rotated refresh token when the access token is stale', async () => {
    const ctx = await connected('outlook-refresh@kloyya.test', 'outlook');
    // Force a refresh.
    await db
      .update(connections)
      .set({ accessTokenExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(connections.workspaceId, ctx.workspaceId));

    const outcome = await syncOutlookMail(
      db,
      crypto,
      ctx,
      deps(
        fakeGraph({
          token: { access_token: 'fresh-at', refresh_token: 'rotated-rt', expires_in: 3600 },
          first: { value: [{ id: 'm1', subject: 'After refresh' }], '@odata.deltaLink': makeDelta('c') },
        }),
      ),
    );

    expect(outcome.ok).toBe(true);
    // The rotated refresh token must have been stored, or the next refresh fails.
    const [row] = await db
      .select({ refreshTokenEnc: connections.refreshTokenEnc })
      .from(connections)
      .where(and(eq(connections.workspaceId, ctx.workspaceId), eq(connections.integrationId, 'outlook')));
    expect(crypto.decrypt(row!.refreshTokenEnc!)).toBe('rotated-rt');
  });

  it('parks the connection when Microsoft says the grant is revoked', async () => {
    const ctx = await connected('outlook-revoked@kloyya.test', 'outlook');
    await db
      .update(connections)
      .set({ accessTokenExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(connections.workspaceId, ctx.workspaceId));

    const outcome = await syncOutlookMail(
      db,
      crypto,
      ctx,
      deps(fakeGraph({ token: { error: 'invalid_grant', error_description: 'AADSTS700082' } })),
    );

    expect(outcome).toMatchObject({ ok: false, reason: 'revoked' });
    const [row] = await db
      .select({ status: connections.status, errorReason: connections.errorReason })
      .from(connections)
      .where(and(eq(connections.workspaceId, ctx.workspaceId), eq(connections.integrationId, 'outlook')));
    expect(row?.status).toBe('error');
    expect(row?.errorReason).toMatch(/reconnect/i);
  });
});

describe('syncOutlookCalendar', () => {
  it('lands calendar events under the calendar_event resource type', async () => {
    const ctx = await connected('outlook-cal@kloyya.test', 'outlook_calendar');

    const outcome = await syncOutlookCalendar(
      db,
      crypto,
      ctx,
      deps(
        fakeGraph({
          first: {
            value: [{ id: 'e1', subject: 'Sync review' }],
            '@odata.deltaLink': makeDelta('cal-c'),
          },
        }),
      ),
    );

    expect(outcome).toMatchObject({ ok: true, written: 1 });
    const rows = await records(ctx);
    expect(rows[0]?.resourceType).toBe('calendar_event');
    expect(rows[0]?.payload).toMatchObject({ subject: 'Sync review' });
  });
});
