import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { withTenantScope } from '@kloyya/db/scope';
import { connections, syncRecords } from '@kloyya/db/schema';
import type { TokenCrypto } from '../crypto/tokens.js';
import type { StartContext } from './connect.js';
import { getValidAccessToken } from './tokens.js';
import {
  GoogleTransientError,
  isCancelled,
  listCalendars,
  listEvents,
  SyncTokenExpiredError,
  type RawGoogleEvent,
} from './google-calendar.js';

/**
 * The Google Calendar sync.
 *
 * Reads what Google has and lands it verbatim in sync_records. Nothing here
 * interprets an event — no scoring, no summarising, no reshaping into a Meeting.
 * That is the pipeline's job, and keeping the line clean is what lets the
 * pipeline change its mind later without re-reading everyone's calendar.
 */

/** A first sync reaches back this far. A decade of history helps nobody today. */
const FIRST_SYNC_WINDOW_DAYS = 90;
const RESOURCE_TYPE = 'calendar_event';

export interface SyncOutcome {
  ok: boolean;
  /** Objects Google returned. */
  fetched: number;
  /** Objects actually written — the rest were unchanged. */
  written: number;
  /** Objects Google says are gone. */
  tombstoned: number;
  reason?: 'not_connected' | 'revoked' | 'refresh_failed' | 'transient' | 'failed';
}

export interface SyncDeps {
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Land one provider object.
 *
 * The hash is what makes a re-sync cheap: Google re-sends objects that haven't
 * changed, and rewriting them would churn the table and wake the pipeline for
 * nothing. Returns whether anything was actually written.
 */
async function landRecord(
  db: AppDb,
  ctx: StartContext,
  connectionId: string,
  integrationId: string,
  externalId: string,
  payload: unknown,
  cancelled: boolean,
  now: Date,
): Promise<boolean> {
  const contentHash = hashPayload(payload);

  return withTenantScope(db, ctx.organizationId, async (tx) => {
    const [existing] = await tx
      .select({ contentHash: syncRecords.contentHash, deletedAtSource: syncRecords.deletedAtSource })
      .from(syncRecords)
      .where(
        and(
          eq(syncRecords.connectionId, connectionId),
          eq(syncRecords.resourceType, RESOURCE_TYPE),
          eq(syncRecords.externalId, externalId),
        ),
      )
      .limit(1);

    const alreadyTombstoned = existing?.deletedAtSource != null;
    if (existing && existing.contentHash === contentHash && alreadyTombstoned === cancelled) {
      return false;
    }

    await tx
      .insert(syncRecords)
      .values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        connectionId,
        integrationId,
        resourceType: RESOURCE_TYPE,
        externalId,
        payload: payload as object,
        contentHash,
        fetchedAt: now,
        ...(cancelled ? { deletedAtSource: now } : {}),
      })
      .onConflictDoUpdate({
        target: [syncRecords.connectionId, syncRecords.resourceType, syncRecords.externalId],
        set: {
          payload: payload as object,
          contentHash,
          fetchedAt: now,
          // A cancelled event is tombstoned, not removed — "this meeting was
          // cancelled" is intelligence. An un-cancelled one clears the tombstone,
          // because Google lets an event come back.
          deletedAtSource: cancelled ? now : null,
        },
      });

    return true;
  });
}

async function readConnection(
  db: AppDb,
  ctx: StartContext,
  integrationId: string,
): Promise<{ id: string; cursors: Record<string, string> } | null> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select({ id: connections.id, syncCursors: connections.syncCursors })
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
  if (!row) return null;
  return { id: row.id, cursors: (row.syncCursors ?? {}) as Record<string, string> };
}

async function saveProgress(
  db: AppDb,
  ctx: StartContext,
  integrationId: string,
  cursors: Record<string, string>,
  patch: { status?: 'connected' | 'error' | 'syncing'; errorReason?: string | null; syncedAt?: Date },
): Promise<void> {
  await withTenantScope(db, ctx.organizationId, async (tx) => {
    await tx
      .update(connections)
      .set({
        syncCursors: cursors,
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.errorReason !== undefined ? { errorReason: patch.errorReason } : {}),
        ...(patch.syncedAt ? { lastSyncedAt: patch.syncedAt } : {}),
      })
      .where(
        and(
          eq(connections.workspaceId, ctx.workspaceId),
          eq(connections.integrationId, integrationId),
        ),
      );
  });
}

/**
 * Sync a workspace's Google Calendar.
 *
 * Incremental where possible: each calendar carries its own syncToken, and only
 * what changed since comes back. When Google expires a token (410) we drop it and
 * re-read that calendar in full — the alternative is a connection permanently
 * stuck on a cursor Google will never accept again.
 *
 * `lastSyncedAt` is only advanced on success. It is the sentence "your data is
 * current as of…" and it must never be said when it isn't true.
 */
export async function syncGoogleCalendar(
  db: AppDb,
  crypto: TokenCrypto,
  ctx: StartContext,
  deps: SyncDeps,
): Promise<SyncOutcome> {
  const integrationId = 'google_calendar';
  const now = new Date((deps.now ?? Date.now)());

  const connection = await readConnection(db, ctx, integrationId);
  if (!connection) return { ok: false, fetched: 0, written: 0, tombstoned: 0, reason: 'not_connected' };

  const token = await getValidAccessToken(db, crypto, ctx, integrationId, deps);
  if (!token.ok) {
    // getValidAccessToken already parked a revoked connection with a reason; a
    // transient failure deliberately left it alone.
    return { ok: false, fetched: 0, written: 0, tombstoned: 0, reason: token.reason };
  }

  await saveProgress(db, ctx, integrationId, connection.cursors, { status: 'syncing' });

  const cursors = { ...connection.cursors };
  let fetched = 0;
  let written = 0;
  let tombstoned = 0;

  try {
    const calendars = await listCalendars({
      accessToken: token.accessToken,
      ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
    });

    for (const calendar of calendars) {
      const timeMin = new Date(
        now.getTime() - FIRST_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

      let result;
      try {
        result = await listEvents({
          accessToken: token.accessToken,
          calendarId: calendar.id,
          syncToken: cursors[calendar.id],
          timeMin,
          ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
        });
      } catch (error) {
        if (!(error instanceof SyncTokenExpiredError)) throw error;
        // Forget the cursor and re-read this calendar whole.
        delete cursors[calendar.id];
        result = await listEvents({
          accessToken: token.accessToken,
          calendarId: calendar.id,
          timeMin,
          ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
        });
      }

      for (const event of result.events as RawGoogleEvent[]) {
        if (!event.id) continue; // Nothing to key on; not ours to invent.
        fetched += 1;
        const cancelled = isCancelled(event);
        const changed = await landRecord(
          db,
          ctx,
          connection.id,
          integrationId,
          event.id,
          event,
          cancelled,
          now,
        );
        if (changed) {
          written += 1;
          if (cancelled) tombstoned += 1;
        }
      }

      // Only a final page yields a token. Storing null would silently downgrade
      // the next run to a full read.
      if (result.nextSyncToken) cursors[calendar.id] = result.nextSyncToken;
    }
  } catch (error) {
    const transient = error instanceof GoogleTransientError;
    await saveProgress(db, ctx, integrationId, cursors, {
      status: transient ? 'connected' : 'error',
      // A rate limit is not something a user can fix, so it isn't shown as a
      // broken connection — the cursors we did reach are kept either way, so a
      // retry resumes instead of starting over.
      errorReason: transient
        ? null
        : 'Kloyya could not read this calendar. It will try again; reconnect if this persists.',
    });
    return {
      ok: false,
      fetched,
      written,
      tombstoned,
      reason: transient ? 'transient' : 'failed',
    };
  }

  await saveProgress(db, ctx, integrationId, cursors, {
    status: 'connected',
    errorReason: null,
    syncedAt: now,
  });

  return { ok: true, fetched, written, tombstoned };
}
