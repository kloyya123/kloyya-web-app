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
import { syncNotion } from './sync.js';

/**
 * The Notion connector over the search API.
 *
 * A fake Notion stands in. The cases that matter are the ones Notion's absences
 * create: no refresh (a live token read straight, a 401 = revoked), no changes
 * feed (a last_edited_time high-water mark as the cursor), and no deletion feed
 * (an archived page tombstoned).
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

/** A no-credentials deps bag — Notion's sync never refreshes, so these are unused. */
const deps = (fetchImpl: typeof fetch) => ({ clientId: '', clientSecret: '', fetchImpl });

/** A fake Notion search endpoint returning one scripted page. */
function fakeNotion(page: { results: unknown[]; status?: number }): typeof fetch {
  return (async () => {
    if (page.status && page.status !== 200) return new Response('err', { status: page.status });
    return new Response(JSON.stringify({ results: page.results, has_more: false, next_cursor: null }), {
      status: 200,
    });
  }) as unknown as typeof fetch;
}

async function connectedNotion(email: string): Promise<StartContext> {
  const { userId } = await signUp(app, { email, password: 'a sufficiently long passphrase', name: 'Notion Owner' });
  const [profile] = await db
    .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
    .from(users)
    .where(eq(users.id, userId));

  await db.insert(connections).values({
    organizationId: profile!.orgId,
    workspaceId: profile!.wsId!,
    integrationId: 'notion',
    status: 'connected',
    accessTokenEnc: crypto.encrypt('a-notion-token'),
    // No refresh token — Notion never issues one.
    refreshTokenEnc: null,
    accessTokenExpiresAt: null,
    grantedScopes: [],
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

async function connectionRow(ctx: StartContext) {
  const [row] = await db
    .select({
      status: connections.status,
      errorReason: connections.errorReason,
      syncCursors: connections.syncCursors,
      accessTokenEnc: connections.accessTokenEnc,
    })
    .from(connections)
    .where(and(eq(connections.workspaceId, ctx.workspaceId), eq(connections.integrationId, 'notion')));
  return row;
}

describe('syncNotion', () => {
  it('lands pages and databases under their own resource types, and records the watermark', async () => {
    const ctx = await connectedNotion('notion-basic@kloyya.test');

    const outcome = await syncNotion(
      db,
      crypto,
      ctx,
      deps(
        fakeNotion({
          results: [
            { object: 'page', id: 'p1', last_edited_time: '2026-02-05T09:00:00.000Z', properties: {} },
            { object: 'database', id: 'd1', last_edited_time: '2026-02-04T09:00:00.000Z', title: [] },
          ],
        }),
      ),
    );

    expect(outcome).toMatchObject({ ok: true, fetched: 2, written: 2, tombstoned: 0 });
    const rows = await records(ctx);
    expect(rows.find((r) => r.externalId === 'p1')?.resourceType).toBe('notion_page');
    expect(rows.find((r) => r.externalId === 'd1')?.resourceType).toBe('notion_database');
    expect((await connectionRow(ctx))?.syncCursors).toMatchObject({ last_edited: '2026-02-05T09:00:00.000Z' });
  });

  it('tombstones an archived page rather than dropping it', async () => {
    const ctx = await connectedNotion('notion-archived@kloyya.test');

    const outcome = await syncNotion(
      db,
      crypto,
      ctx,
      deps(
        fakeNotion({
          results: [{ object: 'page', id: 'gone', last_edited_time: '2026-02-05T09:00:00.000Z', archived: true }],
        }),
      ),
    );

    expect(outcome).toMatchObject({ ok: true, tombstoned: 1 });
    const rows = await records(ctx);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAtSource).toBeInstanceOf(Date);
  });

  it('does not advance the watermark backward on an empty sync', async () => {
    const ctx = await connectedNotion('notion-empty@kloyya.test');
    // Seed a prior watermark.
    await db
      .update(connections)
      .set({ syncCursors: { last_edited: '2026-02-10T00:00:00.000Z' } })
      .where(and(eq(connections.workspaceId, ctx.workspaceId), eq(connections.integrationId, 'notion')));

    const outcome = await syncNotion(db, crypto, ctx, deps(fakeNotion({ results: [] })));

    expect(outcome).toMatchObject({ ok: true, fetched: 0, written: 0 });
    // The prior mark must survive — a null watermark must not re-read the world.
    expect((await connectionRow(ctx))?.syncCursors).toMatchObject({ last_edited: '2026-02-10T00:00:00.000Z' });
  });

  it('parks the connection and drops the token when Notion returns 401', async () => {
    const ctx = await connectedNotion('notion-revoked@kloyya.test');

    const outcome = await syncNotion(db, crypto, ctx, deps(fakeNotion({ results: [], status: 401 })));

    expect(outcome).toMatchObject({ ok: false, reason: 'revoked' });
    const row = await connectionRow(ctx);
    expect(row?.status).toBe('error');
    expect(row?.errorReason).toMatch(/reconnect/i);
    // A revoked grant's token is dead weight — it must be destroyed.
    expect(row?.accessTokenEnc).toBeNull();
  });

  it('leaves the connection alone when Notion is briefly unavailable (429)', async () => {
    const ctx = await connectedNotion('notion-transient@kloyya.test');

    const outcome = await syncNotion(db, crypto, ctx, deps(fakeNotion({ results: [], status: 429 })));

    expect(outcome).toMatchObject({ ok: false, reason: 'transient' });
    const row = await connectionRow(ctx);
    // Not broken, the provider was — the connection and its token stay intact.
    expect(row?.status).toBe('connected');
    expect(row?.accessTokenEnc).not.toBeNull();
  });

  it('reports not_connected when there is no Notion connection', async () => {
    const { userId } = await signUp(app, {
      email: 'notion-absent@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'No Notion',
    });
    const [profile] = await db
      .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
      .from(users)
      .where(eq(users.id, userId));

    const outcome = await syncNotion(
      db,
      crypto,
      { userId, workspaceId: profile!.wsId!, organizationId: profile!.orgId },
      deps(fakeNotion({ results: [] })),
    );

    expect(outcome).toMatchObject({ ok: false, reason: 'not_connected' });
  });
});
