import { and, eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { withTenantScope } from '@kloyya/db/scope';
import { connections, users } from '@kloyya/db/schema';
import {
  INTEGRATION_CATALOG,
  isConnected,
  type ConnectionStatus,
  type IntegrationCategory,
  type IntegrationConnection,
} from '@kloyya/core';

/**
 * The Connection Manager, over the catalogue in @kloyya/core.
 *
 * The catalogue is the source of truth for what CAN be connected; this table
 * holds only what IS. A tool nobody has touched has no row and reports
 * `not_connected` — the absence of a row is the state, so there is nothing to
 * seed and nothing to drift.
 *
 * Tokens are never selected here. `IntegrationConnection` has no field for them,
 * which is the point: the shape the API returns cannot carry a secret even by
 * accident.
 */
export interface ConnectionSummary {
  connected: number;
  total: number;
  needsAttention: number;
  preview: IntegrationConnection[];
}

/** How many apps the dashboard widget names before collapsing to "+N". */
const PREVIEW_LIMIT = 3;

interface Tenant {
  organizationId: string;
  workspaceId: string;
}

async function resolveTenant(db: AppDb, authUserId: string): Promise<Tenant | null> {
  const [row] = await db
    .select({ organizationId: users.organizationId, workspaceId: users.activeWorkspaceId })
    .from(users)
    .where(eq(users.id, authUserId))
    .limit(1);
  if (!row?.workspaceId) return null;
  return { organizationId: row.organizationId, workspaceId: row.workspaceId };
}

interface LiveRow {
  integrationId: string;
  status: ConnectionStatus;
  lastSyncedAt: Date | null;
  errorReason: string | null;
}

/** The workspace's connection rows, read inside the tenant boundary. */
async function liveRows(db: AppDb, tenant: Tenant): Promise<Map<string, LiveRow>> {
  const rows = await withTenantScope(db, tenant.organizationId, async (tx) =>
    tx
      .select({
        integrationId: connections.integrationId,
        status: connections.status,
        lastSyncedAt: connections.lastSyncedAt,
        errorReason: connections.errorReason,
      })
      .from(connections)
      .where(eq(connections.workspaceId, tenant.workspaceId)),
  );
  return new Map(rows.map((r) => [r.integrationId, r]));
}

function toConnection(
  definition: (typeof INTEGRATION_CATALOG)[number],
  row: LiveRow | undefined,
): IntegrationConnection {
  return {
    definition,
    status: row?.status ?? 'not_connected',
    lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
    // exactOptionalPropertyTypes: an absent reason is an absent key. The contract
    // says errorReason is present ONLY on 'error', so a stale reason from a
    // recovered connection must not survive into the response.
    ...(row?.status === 'error' && row.errorReason ? { errorReason: row.errorReason } : {}),
  };
}

export async function listConnections(
  db: AppDb,
  authUserId: string,
  category?: IntegrationCategory,
): Promise<IntegrationConnection[] | null> {
  const tenant = await resolveTenant(db, authUserId);
  if (!tenant) return null;

  const rows = await liveRows(db, tenant);
  return INTEGRATION_CATALOG.filter((d) => !category || d.category === category).map((d) =>
    toConnection(d, rows.get(d.id)),
  );
}

export async function getConnection(
  db: AppDb,
  authUserId: string,
  integrationId: string,
): Promise<IntegrationConnection | null> {
  const definition = INTEGRATION_CATALOG.find((d) => d.id === integrationId);
  // An id outside the catalogue isn't a connection in an unknown state — it isn't
  // a thing Kloyya can connect to at all.
  if (!definition) return null;

  const tenant = await resolveTenant(db, authUserId);
  if (!tenant) return null;

  const rows = await liveRows(db, tenant);
  return toConnection(definition, rows.get(integrationId));
}

export async function getSummary(
  db: AppDb,
  authUserId: string,
): Promise<ConnectionSummary | null> {
  const all = await listConnections(db, authUserId);
  if (!all) return null;

  // `isConnected` from the catalogue module is the single source of this rule
  // (everything except not_connected), so the manager, the widget and this
  // summary cannot disagree about what "connected" means.
  const live = all.filter(isConnected);
  return {
    connected: live.length,
    total: all.length,
    needsAttention: live.filter((c) => c.status === 'error').length,
    preview: live.slice(0, PREVIEW_LIMIT),
  };
}

export type LifecycleResult =
  | { ok: true; connection: IntegrationConnection }
  | { ok: false; reason: 'unknown_integration' | 'no_profile' | 'wrong_state'; current?: ConnectionStatus };

/**
 * Move a connection between states, refusing transitions that don't make sense.
 *
 * `allowedFrom` is checked against what's actually stored rather than trusted
 * from the caller: pausing an already-paused tool, or resuming one that's in
 * error, is a confused client and a 409 tells it so — silently succeeding would
 * report a state the connector isn't in.
 */
async function transition(
  db: AppDb,
  authUserId: string,
  integrationId: string,
  allowedFrom: readonly ConnectionStatus[],
  next: ConnectionStatus,
): Promise<LifecycleResult> {
  const definition = INTEGRATION_CATALOG.find((d) => d.id === integrationId);
  if (!definition) return { ok: false, reason: 'unknown_integration' };

  const tenant = await resolveTenant(db, authUserId);
  if (!tenant) return { ok: false, reason: 'no_profile' };

  return withTenantScope(db, tenant.organizationId, async (tx) => {
    const [row] = await tx
      .select({
        status: connections.status,
        lastSyncedAt: connections.lastSyncedAt,
        errorReason: connections.errorReason,
      })
      .from(connections)
      .where(
        and(
          eq(connections.workspaceId, tenant.workspaceId),
          eq(connections.integrationId, integrationId),
        ),
      )
      .limit(1);

    const current: ConnectionStatus = row?.status ?? 'not_connected';
    if (!allowedFrom.includes(current)) {
      return { ok: false, reason: 'wrong_state', current } as const;
    }

    const [updated] = await tx
      .update(connections)
      .set({
        status: next,
        // Leaving the reason behind would have a healthy connection still
        // explaining a failure it has recovered from.
        ...(next === 'error' ? {} : { errorReason: null }),
      })
      .where(
        and(
          eq(connections.workspaceId, tenant.workspaceId),
          eq(connections.integrationId, integrationId),
        ),
      )
      .returning({
        status: connections.status,
        lastSyncedAt: connections.lastSyncedAt,
        errorReason: connections.errorReason,
      });

    if (!updated) return { ok: false, reason: 'wrong_state', current } as const;

    return {
      ok: true,
      connection: toConnection(definition, { integrationId, ...updated }),
    } as const;
  });
}

/** connected/syncing → paused. Keeps the data, stops syncing. */
export async function pauseConnection(
  db: AppDb,
  authUserId: string,
  integrationId: string,
): Promise<LifecycleResult> {
  return transition(db, authUserId, integrationId, ['connected', 'syncing'], 'paused');
}

/** paused → connected. */
export async function resumeConnection(
  db: AppDb,
  authUserId: string,
  integrationId: string,
): Promise<LifecycleResult> {
  return transition(db, authUserId, integrationId, ['paused'], 'connected');
}

/**
 * Anything connected → not_connected, and the tokens are DELETED.
 *
 * The row goes rather than flipping to `not_connected`, because a disconnected
 * integration holding a live refresh token is exactly what disconnecting is
 * meant to prevent. Absence of a row is the not_connected state, so deleting is
 * both the strongest guarantee and the simplest one.
 */
export async function disconnectConnection(
  db: AppDb,
  authUserId: string,
  integrationId: string,
): Promise<LifecycleResult> {
  const definition = INTEGRATION_CATALOG.find((d) => d.id === integrationId);
  if (!definition) return { ok: false, reason: 'unknown_integration' };

  const tenant = await resolveTenant(db, authUserId);
  if (!tenant) return { ok: false, reason: 'no_profile' };

  return withTenantScope(db, tenant.organizationId, async (tx) => {
    const deleted = await tx
      .delete(connections)
      .where(
        and(
          eq(connections.workspaceId, tenant.workspaceId),
          eq(connections.integrationId, integrationId),
        ),
      )
      .returning({ id: connections.id });

    if (deleted.length === 0) {
      return { ok: false, reason: 'wrong_state', current: 'not_connected' } as const;
    }

    return { ok: true, connection: toConnection(definition, undefined) } as const;
  });
}
