import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { connections, users } from '@kloyya/db/schema';
import { createTokenCrypto } from '../crypto/tokens.js';
import { createTestApp, signUp } from '../test/app.js';
import type { StartContext } from './connect.js';
import { getValidAccessToken } from './tokens.js';

/**
 * Token refresh — what a connection actually lives on after its first hour.
 *
 * The cases that matter are the two kinds of failure: the permanent one (the
 * user took the permission back), which must stop and ask for a human, and the
 * transient one (Google was down), which must not destroy a working connection.
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

const fetchReturning = (body: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

/** A connected Google Calendar whose access token expired an hour ago. */
async function connectedWithExpiredToken(email: string): Promise<StartContext> {
  const { userId } = await signUp(app, {
    email,
    password: 'a sufficiently long passphrase',
    name: 'Token Owner',
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
    accessTokenEnc: crypto.encrypt('stale-access-token'),
    refreshTokenEnc: crypto.encrypt('the-refresh-token'),
    accessTokenExpiresAt: new Date(Date.now() - 60 * 60 * 1000),
    grantedScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });

  return { userId, workspaceId: profile!.wsId!, organizationId: profile!.orgId };
}

async function connectionRow(ctx: StartContext) {
  const [row] = await db
    .select({
      status: connections.status,
      accessTokenEnc: connections.accessTokenEnc,
      refreshTokenEnc: connections.refreshTokenEnc,
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

const deps = (fetchImpl: typeof fetch) => ({
  clientId: 'id',
  clientSecret: 'secret',
  fetchImpl,
});

describe('getValidAccessToken', () => {
  it('uses the stored token while it is still fresh', async () => {
    const ctx = await connectedWithExpiredToken('fresh-token@kloyya.test');
    // Push expiry into the future.
    await db
      .update(connections)
      .set({ accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000) })
      .where(eq(connections.workspaceId, ctx.workspaceId));

    const result = await getValidAccessToken(db, crypto, ctx, 'google_calendar', {
      clientId: 'id',
      clientSecret: 'secret',
      // No refresh should happen; if it does, this explodes.
      fetchImpl: (() => {
        throw new Error('should not have refreshed');
      }) as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: true, accessToken: 'stale-access-token' });
  });

  it('refreshes an expired token and re-encrypts the new one', async () => {
    const ctx = await connectedWithExpiredToken('refresh@kloyya.test');

    const result = await getValidAccessToken(
      db,
      crypto,
      ctx,
      'google_calendar',
      deps(fetchReturning({ access_token: 'brand-new-token', expires_in: 3600 })),
    );

    expect(result).toEqual({ ok: true, accessToken: 'brand-new-token' });

    const row = await connectionRow(ctx);
    // Stored encrypted, never in the clear.
    expect(row?.accessTokenEnc).not.toBe('brand-new-token');
    expect(row?.accessTokenEnc?.startsWith('v1.')).toBe(true);
    expect(crypto.decrypt(row!.accessTokenEnc!)).toBe('brand-new-token');
  });

  it('stores a rotated refresh token when Google sends one', async () => {
    const ctx = await connectedWithExpiredToken('rotate@kloyya.test');

    await getValidAccessToken(
      db,
      crypto,
      ctx,
      'google_calendar',
      deps(
        fetchReturning({
          access_token: 'new-access',
          refresh_token: 'rotated-refresh',
          expires_in: 3600,
        }),
      ),
    );

    // Keeping the old one would make the NEXT refresh fail for no visible reason.
    const row = await connectionRow(ctx);
    expect(crypto.decrypt(row!.refreshTokenEnc!)).toBe('rotated-refresh');
  });

  it('keeps the existing refresh token when Google sends none', async () => {
    const ctx = await connectedWithExpiredToken('norotate@kloyya.test');

    await getValidAccessToken(
      db,
      crypto,
      ctx,
      'google_calendar',
      deps(fetchReturning({ access_token: 'new-access', expires_in: 3600 })),
    );

    const row = await connectionRow(ctx);
    expect(crypto.decrypt(row!.refreshTokenEnc!)).toBe('the-refresh-token');
  });

  it('parks the connection and destroys the tokens when the user revokes access', async () => {
    const ctx = await connectedWithExpiredToken('revoked@kloyya.test');

    const result = await getValidAccessToken(
      db,
      crypto,
      ctx,
      'google_calendar',
      deps(fetchReturning({ error: 'invalid_grant' })),
    );

    expect(result).toEqual({ ok: false, reason: 'revoked' });

    const row = await connectionRow(ctx);
    expect(row?.status).toBe('error');
    // A reason a person can act on, not a stack trace.
    expect(row?.errorReason).toMatch(/revoked|Reconnect/i);
    // The user asked us to stop having these. Keeping them "just in case" would
    // be a secret held for no reason.
    expect(row?.accessTokenEnc).toBeNull();
    expect(row?.refreshTokenEnc).toBeNull();
  });

  it('leaves a working connection intact when Google is merely down', async () => {
    const ctx = await connectedWithExpiredToken('transient@kloyya.test');

    const result = await getValidAccessToken(
      db,
      crypto,
      ctx,
      'google_calendar',
      deps(fetchReturning({ error: 'internal_failure' })),
    );

    expect(result).toEqual({ ok: false, reason: 'refresh_failed' });

    // The connection is not broken — Google was. Destroying it here would make
    // every Google outage a mass disconnection.
    const row = await connectionRow(ctx);
    expect(row?.status).toBe('connected');
    expect(row?.refreshTokenEnc).not.toBeNull();
  });

  it('recovers a parked connection once a refresh succeeds again', async () => {
    const ctx = await connectedWithExpiredToken('recovered@kloyya.test');
    await db
      .update(connections)
      .set({ status: 'error', errorReason: 'Something went wrong earlier.' })
      .where(eq(connections.workspaceId, ctx.workspaceId));

    const result = await getValidAccessToken(
      db,
      crypto,
      ctx,
      'google_calendar',
      deps(fetchReturning({ access_token: 'working-again', expires_in: 3600 })),
    );

    expect(result.ok).toBe(true);
    const row = await connectionRow(ctx);
    // A successful refresh IS proof the connection works.
    expect(row?.status).toBe('connected');
    expect(row?.errorReason).toBeNull();
  });

  it('reports not_connected for an integration that was never connected', async () => {
    const { userId } = await signUp(app, {
      email: 'never@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Never',
    });
    const [profile] = await db
      .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
      .from(users)
      .where(eq(users.id, userId));

    const result = await getValidAccessToken(
      db,
      crypto,
      { userId, workspaceId: profile!.wsId!, organizationId: profile!.orgId },
      'google_calendar',
      deps(fetchReturning({})),
    );

    expect(result).toEqual({ ok: false, reason: 'not_connected' });
  });
});
