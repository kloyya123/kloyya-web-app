import { and, eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { withTenantScope } from '@kloyya/db/scope';
import { connections, users } from '@kloyya/db/schema';
import type { TokenCrypto } from '../crypto/tokens.js';
import type { GoogleTokens } from './google.js';
import { GOOGLE_SCOPES } from './google.js';

export interface StartContext {
  userId: string;
  workspaceId: string;
  organizationId: string;
}

/** Where the caller stands before we send them to Google. */
export async function resolveStartContext(
  db: AppDb,
  authUserId: string,
): Promise<StartContext | null> {
  const [row] = await db
    .select({ organizationId: users.organizationId, workspaceId: users.activeWorkspaceId })
    .from(users)
    .where(eq(users.id, authUserId))
    .limit(1);
  if (!row?.workspaceId) return null;
  return {
    userId: authUserId,
    workspaceId: row.workspaceId,
    organizationId: row.organizationId,
  };
}

/** Mark the connection as in-flight, so the UI can show 'connecting'. */
export async function markConnecting(
  db: AppDb,
  ctx: StartContext,
  integrationId: string,
): Promise<void> {
  await withTenantScope(db, ctx.organizationId, async (tx) => {
    await tx
      .insert(connections)
      .values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        integrationId,
        status: 'connecting',
        connectedByUserId: ctx.userId,
      })
      .onConflictDoUpdate({
        target: [connections.workspaceId, connections.integrationId],
        set: { status: 'connecting', errorReason: null },
      });
  });
}

export type StoreResult =
  | { ok: true; missingScopes: string[] }
  | { ok: false; reason: 'no_refresh_token' | 'scopes_refused' };

/**
 * Persist the tokens Google returned.
 *
 * Two ways this legitimately fails, and both are the user's business:
 *
 *  • No refresh token. Google only issues one on first consent unless asked with
 *    access_type=offline&prompt=consent. Without it the connection dies silently
 *    when the access token expires in an hour — so it is refused now, loudly,
 *    rather than working today and breaking on its own tomorrow.
 *  • Scopes refused. Google's consent screen lets a user tick fewer boxes than
 *    we asked for. A connector missing the scope it needs isn't connected; it's
 *    a card that says "connected" above a sync that will 403 forever.
 *
 * Tokens are encrypted before they touch the row. Nothing else in this file, or
 * any file, writes them in the clear.
 */
export async function storeGoogleTokens(
  db: AppDb,
  crypto: TokenCrypto,
  ctx: StartContext,
  integrationId: string,
  tokens: GoogleTokens,
): Promise<StoreResult> {
  const required = GOOGLE_SCOPES[integrationId] ?? [];
  const missing = required.filter((scope) => !tokens.grantedScopes.includes(scope));

  if (missing.length > 0) {
    await failConnection(
      db,
      ctx,
      integrationId,
      'Kloyya needs all the permissions on the card to read this. Reconnect and accept them.',
    );
    return { ok: false, reason: 'scopes_refused' };
  }

  if (!tokens.refreshToken) {
    await failConnection(
      db,
      ctx,
      integrationId,
      'Google did not return a refresh token, so the connection would expire within the hour. Reconnect to try again.',
    );
    return { ok: false, reason: 'no_refresh_token' };
  }

  await withTenantScope(db, ctx.organizationId, async (tx) => {
    await tx
      .insert(connections)
      .values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        integrationId,
        status: 'connected',
        connectedByUserId: ctx.userId,
        accessTokenEnc: crypto.encrypt(tokens.accessToken),
        refreshTokenEnc: crypto.encrypt(tokens.refreshToken!),
        ...(tokens.expiresAt ? { accessTokenExpiresAt: tokens.expiresAt } : {}),
        grantedScopes: tokens.grantedScopes,
        errorReason: null,
      })
      .onConflictDoUpdate({
        target: [connections.workspaceId, connections.integrationId],
        set: {
          status: 'connected',
          connectedByUserId: ctx.userId,
          accessTokenEnc: crypto.encrypt(tokens.accessToken),
          refreshTokenEnc: crypto.encrypt(tokens.refreshToken!),
          accessTokenExpiresAt: tokens.expiresAt ?? null,
          grantedScopes: tokens.grantedScopes,
          errorReason: null,
        },
      });
  });

  return { ok: true, missingScopes: [] };
}

/** Put a connection into `error` with a reason a human can act on. */
export async function failConnection(
  db: AppDb,
  ctx: StartContext,
  integrationId: string,
  reason: string,
): Promise<void> {
  await withTenantScope(db, ctx.organizationId, async (tx) => {
    await tx
      .insert(connections)
      .values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        integrationId,
        status: 'error',
        connectedByUserId: ctx.userId,
        errorReason: reason,
      })
      .onConflictDoUpdate({
        target: [connections.workspaceId, connections.integrationId],
        set: { status: 'error', errorReason: reason },
      });
  });
}

/** The stored tokens for a connection, decrypted. Never leaves the server. */
export async function readGoogleTokens(
  db: AppDb,
  crypto: TokenCrypto,
  ctx: StartContext,
  integrationId: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select({
        accessTokenEnc: connections.accessTokenEnc,
        refreshTokenEnc: connections.refreshTokenEnc,
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
  if (!row?.accessTokenEnc || !row.refreshTokenEnc) return null;

  return {
    accessToken: crypto.decrypt(row.accessTokenEnc),
    refreshToken: crypto.decrypt(row.refreshTokenEnc),
  };
}
