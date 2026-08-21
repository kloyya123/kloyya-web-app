import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppDb } from '@kloyya/db/client';
import { connections } from '@kloyya/db/schema';
import { withTenantScope } from '@kloyya/db/scope';
import { eq } from 'drizzle-orm';
import { createTestDb, createTestIdentity, startContextFor } from '../test/harness';
import type { StartContext } from '../tenant';
import { createTokenCrypto, type TokenCrypto } from '../crypto/tokens';
import { storeGoogleTokens } from './connect';

/**
 * A reconnect must look like a first sync, not a no-op.
 *
 * `useFirstSync` (features/connections/use-first-sync.ts) only auto-triggers a
 * sync when `lastSyncedAt` is null. Before this fix, reconnecting after a
 * revoked/rotated OAuth client stored a fresh token onto the SAME row without
 * touching `lastSyncedAt` — so the row still carried a timestamp from before
 * the revoke, the hook saw "already synced", and Gmail silently never synced
 * again until someone noticed and clicked "Sync now" by hand.
 */
describe('storeGoogleTokens', () => {
  let db: AppDb;
  let ctx: StartContext;
  let crypto: TokenCrypto;

  beforeEach(async () => {
    ({ db } = await createTestDb());
    const identity = await createTestIdentity(db, { email: 'owner@example.com' });
    ctx = await startContextFor(db, identity);
    crypto = createTokenCrypto(randomBytes(32).toString('base64'));
  });

  async function readLastSyncedAt(): Promise<Date | null> {
    return withTenantScope(db, ctx.organizationId, async (tx) => {
      const [row] = await tx
        .select({ lastSyncedAt: connections.lastSyncedAt })
        .from(connections)
        .where(eq(connections.integrationId, 'gmail'));
      return row?.lastSyncedAt ?? null;
    });
  }

  const validTokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: new Date('2026-08-01T00:00:00.000Z'),
    grantedScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  };

  it('leaves lastSyncedAt null on a brand-new connection', async () => {
    const result = await storeGoogleTokens(db, crypto, ctx, 'gmail', validTokens);
    expect(result.ok).toBe(true);
    expect(await readLastSyncedAt()).toBeNull();
  });

  it('resets lastSyncedAt to null on a reconnect, so the row reads as needing a first sync again', async () => {
    await storeGoogleTokens(db, crypto, ctx, 'gmail', validTokens);

    // Simulate a sync having actually run against the old token.
    await withTenantScope(db, ctx.organizationId, async (tx) => {
      await tx
        .update(connections)
        .set({ lastSyncedAt: new Date('2026-07-01T00:00:00.000Z') })
        .where(eq(connections.integrationId, 'gmail'));
    });
    expect(await readLastSyncedAt()).not.toBeNull();

    // The OAuth client rotated; the user reconnects, storing a new token onto
    // the same row. This must NOT leave the old sync timestamp in place.
    await storeGoogleTokens(db, crypto, ctx, 'gmail', {
      ...validTokens,
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });

    expect(await readLastSyncedAt()).toBeNull();
  });

  it('does not touch lastSyncedAt when the reconnect is refused for missing scopes', async () => {
    await storeGoogleTokens(db, crypto, ctx, 'gmail', validTokens);
    await withTenantScope(db, ctx.organizationId, async (tx) => {
      await tx
        .update(connections)
        .set({ lastSyncedAt: new Date('2026-07-01T00:00:00.000Z') })
        .where(eq(connections.integrationId, 'gmail'));
    });

    const result = await storeGoogleTokens(db, crypto, ctx, 'gmail', {
      ...validTokens,
      grantedScopes: [], // Refused every scope Kloyya asked for.
    });

    expect(result.ok).toBe(false);
    // A refused reconnect leaves the connection in `error`, still pointed at
    // the last real sync — there is no new token to treat as "unsynced".
    expect(await readLastSyncedAt()).not.toBeNull();
  });
});
