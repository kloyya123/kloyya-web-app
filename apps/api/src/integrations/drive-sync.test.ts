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
import { syncGoogleDrive } from './sync.js';

/**
 * The Google Drive sync.
 *
 * A fake Drive stands in for the real one. The cases that matter are the ones a
 * connector gets wrong: a first sync that must ALSO capture a resume token, a
 * trashed file that should tombstone rather than vanish, an expired page token
 * that must recover instead of stalling, and the metadata-only promise — nothing
 * resembling file content ever reaches storage.
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
 * A fake Drive: scripted responses for the three endpoints the connector hits.
 * `changes` is keyed by the incoming pageToken so a test can script a sequence.
 */
function fakeDrive(script: {
  startPageToken?: string;
  files?: unknown[];
  changes?: Record<string, unknown | number>;
}): typeof fetch {
  return (async (input: string | URL) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const path = url.pathname;

    if (path.endsWith('/changes/startPageToken')) {
      return new Response(JSON.stringify({ startPageToken: script.startPageToken ?? 'tok-1' }), {
        status: 200,
      });
    }
    if (path.endsWith('/changes')) {
      const token = url.searchParams.get('pageToken') ?? '';
      const page = script.changes?.[token];
      if (page === 410) return new Response('gone', { status: 410 });
      if (page === 429) return new Response('slow', { status: 429 });
      return new Response(JSON.stringify(page ?? { changes: [], newStartPageToken: 'tok-next' }), {
        status: 200,
      });
    }
    if (path.endsWith('/files')) {
      return new Response(JSON.stringify({ files: script.files ?? [] }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
}

async function connected(email: string): Promise<StartContext> {
  const { userId } = await signUp(app, {
    email,
    password: 'a sufficiently long passphrase',
    name: 'Drive Owner',
  });
  const [profile] = await db
    .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
    .from(users)
    .where(eq(users.id, userId));

  await db.insert(connections).values({
    organizationId: profile!.orgId,
    workspaceId: profile!.wsId!,
    integrationId: 'google_drive',
    status: 'connected',
    accessTokenEnc: crypto.encrypt('a-live-access-token'),
    refreshTokenEnc: crypto.encrypt('a-refresh-token'),
    accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    grantedScopes: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
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

async function cursorFor(ctx: StartContext) {
  const [row] = await db
    .select({ syncCursors: connections.syncCursors })
    .from(connections)
    .where(
      and(eq(connections.workspaceId, ctx.workspaceId), eq(connections.integrationId, 'google_drive')),
    );
  return (row?.syncCursors as Record<string, string>)['changes'];
}

const file = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  mimeType: 'application/vnd.google-apps.document',
  modifiedTime: '2026-02-01T10:00:00Z',
  trashed: false,
  ...extra,
});

describe('syncGoogleDrive', () => {
  it('enumerates files on a first sync and records the resume token', async () => {
    const ctx = await connected('drive-first@kloyya.test');

    const outcome = await syncGoogleDrive(
      db,
      crypto,
      ctx,
      deps(fakeDrive({ startPageToken: 'tok-start', files: [file('f1', 'Plan'), file('f2', 'Budget')] })),
    );

    expect(outcome).toMatchObject({ ok: true, fetched: 2, written: 2, tombstoned: 0 });

    const rows = await records(ctx);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.externalId === 'f1')?.payload).toMatchObject({ name: 'Plan' });
    expect(rows[0]?.resourceType).toBe('file');

    // A first sync that forgets the resume token silently becomes a full read
    // every run.
    expect(await cursorFor(ctx)).toBe('tok-start');
  });

  it('applies incremental changes from the saved token', async () => {
    const ctx = await connected('drive-incr@kloyya.test');
    await syncGoogleDrive(
      db,
      crypto,
      ctx,
      deps(fakeDrive({ startPageToken: 'tok-a', files: [file('f1', 'Original')] })),
    );

    const outcome = await syncGoogleDrive(
      db,
      crypto,
      ctx,
      deps(
        fakeDrive({
          changes: {
            'tok-a': {
              changes: [{ fileId: 'f1', removed: false, file: file('f1', 'Renamed') }],
              newStartPageToken: 'tok-b',
            },
          },
        }),
      ),
    );

    expect(outcome).toMatchObject({ ok: true, written: 1 });
    const rows = await records(ctx);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toMatchObject({ name: 'Renamed' });
    expect(await cursorFor(ctx)).toBe('tok-b');
  });

  it('tombstones a trashed file rather than deleting it', async () => {
    const ctx = await connected('drive-trash@kloyya.test');
    await syncGoogleDrive(
      db,
      crypto,
      ctx,
      deps(fakeDrive({ startPageToken: 'tok-a', files: [file('f1', 'Doomed')] })),
    );

    const outcome = await syncGoogleDrive(
      db,
      crypto,
      ctx,
      deps(
        fakeDrive({
          changes: {
            'tok-a': {
              changes: [{ fileId: 'f1', removed: false, file: file('f1', 'Doomed', { trashed: true }) }],
              newStartPageToken: 'tok-b',
            },
          },
        }),
      ),
    );

    expect(outcome).toMatchObject({ ok: true, tombstoned: 1 });
    const rows = await records(ctx);
    // "This document was removed" is intelligence — the row stays, tombstoned.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAtSource).toBeInstanceOf(Date);
  });

  it('treats a removed change (gone from view) as a tombstone', async () => {
    const ctx = await connected('drive-removed@kloyya.test');
    await syncGoogleDrive(
      db,
      crypto,
      ctx,
      deps(fakeDrive({ startPageToken: 'tok-a', files: [file('f1', 'Shared')] })),
    );

    const outcome = await syncGoogleDrive(
      db,
      crypto,
      ctx,
      deps(
        fakeDrive({
          changes: {
            'tok-a': {
              // A file that left the user's view arrives with no file object.
              changes: [{ fileId: 'f1', removed: true, file: null }],
              newStartPageToken: 'tok-b',
            },
          },
        }),
      ),
    );

    expect(outcome).toMatchObject({ ok: true, tombstoned: 1 });
    expect((await records(ctx))[0]?.deletedAtSource).toBeInstanceOf(Date);
  });

  it('re-reads in full when Drive expires the page token', async () => {
    const ctx = await connected('drive-410@kloyya.test');
    await syncGoogleDrive(
      db,
      crypto,
      ctx,
      deps(fakeDrive({ startPageToken: 'stale', files: [file('f1', 'Old')] })),
    );

    // 410 on the stale token, then recovery: a fresh full read + new token.
    const outcome = await syncGoogleDrive(
      db,
      crypto,
      ctx,
      deps(
        fakeDrive({
          startPageToken: 'tok-fresh',
          files: [file('f1', 'Old'), file('f2', 'New')],
          changes: { stale: 410 },
        }),
      ),
    );

    expect(outcome).toMatchObject({ ok: true });
    // Recovered rather than stuck on a token Drive will never accept again.
    expect(await cursorFor(ctx)).toBe('tok-fresh');
    expect(await records(ctx)).toHaveLength(2);
  });

  it('skips a file Drive re-sent unchanged', async () => {
    const ctx = await connected('drive-unchanged@kloyya.test');
    await syncGoogleDrive(
      db,
      crypto,
      ctx,
      deps(fakeDrive({ startPageToken: 'tok-a', files: [file('f1', 'Stable')] })),
    );

    const second = await syncGoogleDrive(
      db,
      crypto,
      ctx,
      deps(
        fakeDrive({
          changes: {
            'tok-a': {
              changes: [{ fileId: 'f1', removed: false, file: file('f1', 'Stable') }],
              newStartPageToken: 'tok-b',
            },
          },
        }),
      ),
    );

    // Identical payload: nothing written, no pipeline woken for nothing.
    expect(second).toMatchObject({ ok: true, fetched: 1, written: 0 });
  });

  it('never stores anything resembling file content — metadata only', async () => {
    const ctx = await connected('drive-metadata@kloyya.test');
    await syncGoogleDrive(
      db,
      crypto,
      ctx,
      deps(fakeDrive({ startPageToken: 'tok-a', files: [file('f1', 'Report')] })),
    );

    // The scope is metadata-only; the payload is Drive's file metadata verbatim,
    // and there is simply no content field for anything sensitive to hide in.
    const [row] = await records(ctx);
    const payload = row?.payload as Record<string, unknown>;
    expect(payload['name']).toBe('Report');
    expect(payload).not.toHaveProperty('content');
    expect(payload).not.toHaveProperty('body');
  });

  it('keeps the connection healthy when Drive rate-limits a first sync', async () => {
    const ctx = await connected('drive-429@kloyya.test');

    const rateLimited = (async (input: string | URL) => {
      const url = new URL(typeof input === 'string' ? input : input.toString());
      if (url.pathname.endsWith('/files')) return new Response('slow', { status: 429 });
      if (url.pathname.endsWith('/startPageToken')) {
        return new Response(JSON.stringify({ startPageToken: 'x' }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    const outcome = await syncGoogleDrive(db, crypto, ctx, deps(rateLimited));

    expect(outcome).toMatchObject({ ok: false, reason: 'transient' });
    const [row] = await db
      .select({ status: connections.status, lastSyncedAt: connections.lastSyncedAt })
      .from(connections)
      .where(
        and(eq(connections.workspaceId, ctx.workspaceId), eq(connections.integrationId, 'google_drive')),
      );
    // A blip is not a broken connection, and freshness is never overstated.
    expect(row?.status).toBe('connected');
    expect(row?.lastSyncedAt).toBeNull();
  });

  it('refuses to sync when Drive was never connected', async () => {
    const { userId } = await signUp(app, {
      email: 'drive-none@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'None',
    });
    const [profile] = await db
      .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
      .from(users)
      .where(eq(users.id, userId));

    const outcome = await syncGoogleDrive(
      db,
      crypto,
      { userId, workspaceId: profile!.wsId!, organizationId: profile!.orgId },
      deps(fakeDrive({})),
    );

    expect(outcome).toMatchObject({ ok: false, reason: 'not_connected' });
  });
});
