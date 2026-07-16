import { and, eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { withTenantScope } from '@kloyya/db/scope';
import { connections } from '@kloyya/db/schema';
import type { TokenCrypto } from '../crypto/tokens.js';
import { GoogleAuthRevokedError, refreshGoogleToken } from './google.js';
import type { StartContext } from './connect.js';

/**
 * Keeping a connection alive.
 *
 * Google's access tokens last about an hour, so after day one a connector runs
 * entirely on this. The refresh token is the long-lived credential; the access
 * token is disposable.
 *
 * Refreshed a minute early on purpose: a token that is valid when we check and
 * expired when Google reads it produces a 401 that looks like revocation and
 * isn't. The skew costs nothing and removes a whole class of phantom failure.
 */
const EXPIRY_SKEW_MS = 60 * 1000;

export type AccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: 'not_connected' | 'revoked' | 'refresh_failed' };

export interface RefreshDeps {
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
  /** Injectable so tests don't wait for a real clock. */
  now?: () => number;
}

/**
 * The access token to call Google with, refreshing it if needed.
 *
 * Callers never touch the stored ciphertext; they ask for a token and get one
 * that works, or a reason it can't. The refreshed token is re-encrypted before
 * it is written back — there is no path here that puts a Google token in the
 * database in the clear.
 */
export async function getValidAccessToken(
  db: AppDb,
  crypto: TokenCrypto,
  ctx: StartContext,
  integrationId: string,
  deps: RefreshDeps,
): Promise<AccessTokenResult> {
  const now = deps.now ?? Date.now;

  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select({
        status: connections.status,
        accessTokenEnc: connections.accessTokenEnc,
        refreshTokenEnc: connections.refreshTokenEnc,
        accessTokenExpiresAt: connections.accessTokenExpiresAt,
      })
      .from(connections)
      .where(
        and(
          eq(connections.workspaceId, ctx.workspaceId),
          eq(connections.integrationId, integrationId),
        ),
      )
      .limit(1),
  );

  const row = rows[0];
  if (!row?.accessTokenEnc || !row.refreshTokenEnc) return { ok: false, reason: 'not_connected' };

  const expiresAt = row.accessTokenExpiresAt?.getTime() ?? 0;
  const stillFresh = expiresAt - EXPIRY_SKEW_MS > now();
  if (stillFresh) {
    return { ok: true, accessToken: crypto.decrypt(row.accessTokenEnc) };
  }

  const refreshToken = crypto.decrypt(row.refreshTokenEnc);

  let refreshed;
  try {
    refreshed = await refreshGoogleToken({
      refreshToken,
      clientId: deps.clientId,
      clientSecret: deps.clientSecret,
      ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
    });
  } catch (error) {
    if (error instanceof GoogleAuthRevokedError) {
      // Permanent. Park the connection with a reason a person can act on, rather
      // than retrying something that will never work again.
      await markRevoked(db, ctx, integrationId);
      return { ok: false, reason: 'revoked' };
    }
    // Transient. Leave the connection alone — it is not broken, Google was.
    return { ok: false, reason: 'refresh_failed' };
  }

  await withTenantScope(db, ctx.organizationId, async (tx) => {
    await tx
      .update(connections)
      .set({
        accessTokenEnc: crypto.encrypt(refreshed.accessToken),
        accessTokenExpiresAt: refreshed.expiresAt ?? null,
        // Google rotates refresh tokens sometimes. Keeping the old one when a new
        // one arrives means the next refresh fails for no visible reason.
        ...(refreshed.refreshToken
          ? { refreshTokenEnc: crypto.encrypt(refreshed.refreshToken) }
          : {}),
        // A refresh proves the connection works; if it was parked in error, it
        // has recovered.
        ...(row.status === 'error' ? { status: 'connected' as const, errorReason: null } : {}),
      })
      .where(
        and(
          eq(connections.workspaceId, ctx.workspaceId),
          eq(connections.integrationId, integrationId),
        ),
      );
  });

  return { ok: true, accessToken: refreshed.accessToken };
}

/**
 * Park a connection whose grant is gone, and destroy the tokens with it.
 *
 * They are dead weight the moment Google stops honouring them, and a revoked
 * token kept "just in case" is a secret held for no reason — the user asked us
 * to stop having it.
 */
export async function markRevoked(
  db: AppDb,
  ctx: StartContext,
  integrationId: string,
): Promise<void> {
  await withTenantScope(db, ctx.organizationId, async (tx) => {
    await tx
      .update(connections)
      .set({
        status: 'error',
        errorReason:
          'Google no longer accepts this connection — it was revoked, or the account password changed. Reconnect to resume syncing.',
        accessTokenEnc: null,
        refreshTokenEnc: null,
        accessTokenExpiresAt: null,
      })
      .where(
        and(
          eq(connections.workspaceId, ctx.workspaceId),
          eq(connections.integrationId, integrationId),
        ),
      );
  });
}
