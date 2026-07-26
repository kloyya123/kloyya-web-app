import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { connections, syncRecords } from '@kloyya/db/schema';
import type { TokenCrypto } from '../crypto/tokens';
import type { StartContext } from './connect';
import { getStaticAccessToken, getValidAccessToken, markRevoked } from './tokens';
import {
  validateCalendarEvents,
  validateDriveFiles,
  validateGmailMessages,
  validateNotionItems,
} from './validation';
import {
  isNotionRemoval,
  listNotionChanges,
  NotionTransientError,
  NotionUnauthorizedError,
  type RawNotionItem,
} from './notion-client';
import { GoogleTransientError, SyncTokenExpiredError } from './google-http';
import { isCancelled, listCalendars, listEvents, type RawGoogleEvent } from './google-calendar';
import {
  getMailboxHistoryId,
  getMessage,
  listGmailHistory,
  listRecentMessageIds,
} from './gmail';
import {
  getDriveStartPageToken,
  isDriveRemoval,
  listDriveChanges,
  listDriveFiles,
  type RawDriveFile,
} from './google-drive';
import { validateGraphItems } from './validation';
import { GraphTransientError, listOutlookCalendarDelta, listOutlookMailDelta } from './graph';
import { refreshMicrosoftToken } from './microsoft';

/**
 * The Google Calendar sync.
 *
 * Reads what Google has and lands it verbatim in sync_records. Nothing here
 * interprets an event — no scoring, no summarising, no reshaping into a Meeting.
 * That is the pipeline's job, and keeping the line clean is what lets the
 * pipeline change its mind later without re-reading everyone's calendar.
 */

/**
 * A first sync reaches back this far.
 *
 * Was 90 days. On a busy mailbox that is thousands of messages, each needing its
 * own round trip, and the run never finished inside the function's 60-second
 * budget — so nothing was ever written and the dashboard stayed empty. Two weeks
 * is what a chief of staff can actually act on, and it lands in seconds. Older
 * mail is not lost: the cursor advances, and later runs reach further back.
 */
const FIRST_SYNC_WINDOW_DAYS = 14;

/**
 * Wall-clock budget for one sync run.
 *
 * The route reserves 60 seconds; this stops well short so there is room to save
 * the cursor and return a clean result rather than being killed mid-write. When
 * the budget runs out the run stops early and reports `truncated` — the cursor
 * is deliberately NOT advanced past the unread remainder, so the next run picks
 * up the rest. Every write is an idempotent upsert, so re-reading an overlap
 * costs nothing.
 *
 * This is what makes "a sync finishes in under a minute" a property of the code
 * rather than a hope about someone's mailbox size.
 */
const SYNC_BUDGET_MS = 40_000;

/** How many provider objects to fetch at once. */
const FETCH_CONCURRENCY = 12;

/** When this run must stop doing new work. */
function deadlineFrom(deps: SyncDeps): number {
  const start = deps.now?.() ?? Date.now();
  return start + (deps.budgetMs ?? SYNC_BUDGET_MS);
}

/**
 * Map over items with bounded parallelism, stopping at the deadline.
 *
 * Sequential per-object fetches were the whole problem: a thousand messages meant
 * a thousand round trips end to end. Running a dozen at once turns minutes into
 * seconds without pretending the provider has no rate limit.
 *
 * Returns what it managed plus whether it ran out of time, so the caller can
 * decide what that means for its cursor.
 */
async function fetchWithBudget<T, R>(
  items: T[],
  deadline: number,
  fn: (item: T) => Promise<R | null>,
): Promise<{ results: R[]; truncated: boolean }> {
  const results: R[] = [];
  let index = 0;
  let truncated = false;

  async function worker(): Promise<void> {
    for (;;) {
      if (Date.now() >= deadline) {
        truncated = true;
        return;
      }
      const current = index++;
      if (current >= items.length) return;
      const value = await fn(items[current]!);
      if (value !== null) results.push(value);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, items.length) }, () => worker()),
  );
  return { results, truncated };
}

export interface SyncOutcome {
  ok: boolean;
  /** Objects Google returned. */
  fetched: number;
  /** Objects actually written — the rest were unchanged. */
  written: number;
  /** Objects Google says are gone. */
  tombstoned: number;
  /**
   * Objects refused before storage (Phase 8.5). Reported, never swallowed — a
   * connector that quietly drops records is indistinguishable from one that
   * works.
   */
  rejected: number;
  reason?: 'not_connected' | 'revoked' | 'refresh_failed' | 'transient' | 'failed';
}

export interface SyncDeps {
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Called for each record refused before storage, so rejections are visible. */
  onRejected?: (calendarId: string, failure: { externalId: string | null; reason: string }) => void;
  /** Override the wall-clock budget. Tests use a small value; production uses the default. */
  budgetMs?: number;
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
  resourceType: string,
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
          eq(syncRecords.resourceType, resourceType),
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
        resourceType,
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
          // A cancelled/deleted object is tombstoned, not removed — "this was
          // cancelled" is intelligence. Re-appearing clears the tombstone, because
          // providers do let objects come back.
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
  if (!connection) {
    return { ok: false, fetched: 0, written: 0, tombstoned: 0, rejected: 0, reason: 'not_connected' };
  }

  const token = await getValidAccessToken(db, crypto, ctx, integrationId, deps);
  if (!token.ok) {
    // getValidAccessToken already parked a revoked connection with a reason; a
    // transient failure deliberately left it alone.
    return { ok: false, fetched: 0, written: 0, tombstoned: 0, rejected: 0, reason: token.reason };
  }

  await saveProgress(db, ctx, integrationId, connection.cursors, { status: 'syncing' });

  const cursors = { ...connection.cursors };
  let fetched = 0;
  let written = 0;
  let tombstoned = 0;
  let rejected = 0;

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

      fetched += result.events.length;

      // Phase 8.5: nothing reaches storage unvalidated. Landing raw means we
      // don't reinterpret what Google says — not that we accept what it can't
      // have meant.
      const batch = validateCalendarEvents(result.events as RawGoogleEvent[]);
      rejected += batch.rejected.length;
      for (const failure of batch.rejected) {
        deps.onRejected?.(calendar.id, failure);
      }

      for (const event of batch.valid) {
        const cancelled = isCancelled(event);
        const changed = await landRecord(
          db,
          ctx,
          connection.id,
          integrationId,
          'calendar_event',
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
      rejected,
      reason: transient ? 'transient' : 'failed',
    };
  }

  await saveProgress(db, ctx, integrationId, cursors, {
    status: 'connected',
    errorReason: null,
    syncedAt: now,
  });

  return { ok: true, fetched, written, tombstoned, rejected };
}

/** The single mailbox stream. Gmail's cursor is one historyId, not per-folder. */
const GMAIL_CURSOR_KEY = 'mailbox';
/** Drive is one change stream, so one cursor — its opaque page token. */
const DRIVE_CURSOR_KEY = 'changes';
/** Graph carries the cursor as a whole @odata.deltaLink URL. */
const GRAPH_CURSOR_KEY = 'delta';
/** Notion has no cursor of its own; ours is a last_edited_time high-water mark. */
const NOTION_CURSOR_KEY = 'last_edited';

/**
 * Sync a workspace's Gmail.
 *
 * The shape is the same as Calendar's — refresh the token, read incrementally,
 * validate before storage, advance the cursor only on success — but the middle
 * is Gmail's own:
 *
 *  • The cursor is a single historyId. With one, we ask "what changed since?";
 *    without one (first sync, or an aged-out cursor), we read the recent mailbox
 *    by id and fetch each message's metadata.
 *  • Listing gives ids; each needs its own GET. A message deleted between the two
 *    comes back null and is simply skipped — an ordinary race, not a failure.
 *  • Gmail reports deletions explicitly in its history; those are tombstoned, so
 *    "this thread was deleted" survives as intelligence.
 *
 * After any sync the mailbox's current historyId becomes the next cursor —
 * taken from the profile, because the history feed's own id lags on an empty
 * delta and would re-read the same window forever.
 */
export async function syncGmail(
  db: AppDb,
  crypto: TokenCrypto,
  ctx: StartContext,
  deps: SyncDeps,
): Promise<SyncOutcome> {
  const integrationId = 'gmail';
  const now = new Date((deps.now ?? Date.now)());
  const fetchOpt = deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {};
  const deadline = deadlineFrom(deps);

  const connection = await readConnection(db, ctx, integrationId);
  if (!connection) {
    return { ok: false, fetched: 0, written: 0, tombstoned: 0, rejected: 0, reason: 'not_connected' };
  }

  const token = await getValidAccessToken(db, crypto, ctx, integrationId, deps);
  if (!token.ok) {
    return { ok: false, fetched: 0, written: 0, tombstoned: 0, rejected: 0, reason: token.reason };
  }

  await saveProgress(db, ctx, integrationId, connection.cursors, { status: 'syncing' });

  const cursors = { ...connection.cursors };
  let fetched = 0;
  let written = 0;
  let tombstoned = 0;
  let rejected = 0;

  try {
    const startHistoryId = cursors[GMAIL_CURSOR_KEY];

    let changedIds: string[] = [];
    let deletedIds: string[] = [];

    if (startHistoryId) {
      try {
        const changes = await listGmailHistory({
          accessToken: token.accessToken,
          startHistoryId,
          ...fetchOpt,
        });
        changedIds = changes.changed;
        deletedIds = changes.deleted;
      } catch (error) {
        if (!(error instanceof SyncTokenExpiredError)) throw error;
        // The cursor aged out; fall back to a bounded full read.
        changedIds = await listRecentMessageIds({
          accessToken: token.accessToken,
          days: FIRST_SYNC_WINDOW_DAYS,
          ...fetchOpt,
        });
      }
    } else {
      changedIds = await listRecentMessageIds({
        accessToken: token.accessToken,
        days: FIRST_SYNC_WINDOW_DAYS,
        ...fetchOpt,
      });
    }

    // Tombstone the deletions Gmail reported. A raw payload isn't needed to say
    // "gone"; the id and the tombstone are the record.
    for (const id of deletedIds) {
      const changed = await landRecord(
        db,
        ctx,
        connection.id,
        integrationId,
        'message',
        id,
        { id, deleted: true },
        true,
        now,
      );
      if (changed) {
        written += 1;
        tombstoned += 1;
      }
    }

    // Fetch and land the changed messages, metadata only.
    // Bounded parallelism against a wall clock. Sequentially, a large mailbox
    // meant one round trip per message and the run was killed before writing
    // anything; a dozen at a time finishes in seconds, and the deadline
    // guarantees we stop with time left to save the cursor.
    const { results: fetchedMessages, truncated } = await fetchWithBudget(
      changedIds,
      deadline,
      (id) => getMessage({ accessToken: token.accessToken, id, ...fetchOpt }),
    );
    fetched = fetchedMessages.length + deletedIds.length;

    const batch = validateGmailMessages(fetchedMessages);
    rejected += batch.rejected.length;
    for (const failure of batch.rejected) deps.onRejected?.('mailbox', failure);

    for (const message of batch.valid) {
      const changed = await landRecord(
        db,
        ctx,
        connection.id,
        integrationId,
        'message',
        message.id,
        message,
        false,
        now,
      );
      if (changed) written += 1;
    }

    // The profile's historyId is the true "you are caught up to here" marker —
    // so it is only advanced on a COMPLETE pass. Advancing it after a truncated
    // run would silently skip everything we did not reach, and the gap would
    // never be noticed because the next run would start after it.
    if (!truncated) {
      const nextHistoryId = await getMailboxHistoryId({ accessToken: token.accessToken, ...fetchOpt });
      if (nextHistoryId) cursors[GMAIL_CURSOR_KEY] = nextHistoryId;
    }
  } catch (error) {
    const transient = error instanceof GoogleTransientError;
    await saveProgress(db, ctx, integrationId, cursors, {
      status: transient ? 'connected' : 'error',
      errorReason: transient
        ? null
        : 'Kloyya could not read this mailbox. It will try again; reconnect if this persists.',
    });
    return { ok: false, fetched, written, tombstoned, rejected, reason: transient ? 'transient' : 'failed' };
  }

  await saveProgress(db, ctx, integrationId, cursors, {
    status: 'connected',
    errorReason: null,
    syncedAt: now,
  });

  return { ok: true, fetched, written, tombstoned, rejected };
}

/**
 * Sync a workspace's Google Drive.
 *
 * Drive's incremental model is one opaque page token, not a per-resource cursor.
 * On a first sync there is no token, so we take a start token for NEXT time and
 * enumerate current files. On later syncs, changes.list from the saved token
 * returns only what moved — created, renamed, trashed or removed.
 *
 * A removal (gone from view, or trashed) is a tombstone, not a delete: "this
 * document was removed" is intelligence the pipeline will want. Only metadata is
 * ever stored; the scope cannot read a byte of file content, so there is none to
 * leak.
 */
export async function syncGoogleDrive(
  db: AppDb,
  crypto: TokenCrypto,
  ctx: StartContext,
  deps: SyncDeps,
): Promise<SyncOutcome> {
  const integrationId = 'google_drive';
  const now = new Date((deps.now ?? Date.now)());
  const fetchOpt = deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {};

  const connection = await readConnection(db, ctx, integrationId);
  if (!connection) {
    return { ok: false, fetched: 0, written: 0, tombstoned: 0, rejected: 0, reason: 'not_connected' };
  }

  const token = await getValidAccessToken(db, crypto, ctx, integrationId, deps);
  if (!token.ok) {
    return { ok: false, fetched: 0, written: 0, tombstoned: 0, rejected: 0, reason: token.reason };
  }

  await saveProgress(db, ctx, integrationId, connection.cursors, { status: 'syncing' });

  const cursors = { ...connection.cursors };
  let fetched = 0;
  let written = 0;
  let tombstoned = 0;
  let rejected = 0;

  /** Land one file: live files are validated; removals are tombstoned by id. */
  const land = async (
    fileId: string,
    file: RawDriveFile | null,
    removed: boolean,
  ): Promise<void> => {
    fetched += 1;
    if (removed) {
      const changed = await landRecord(
        db,
        ctx,
        connection.id,
        integrationId,
        'file',
        fileId,
        file ?? { id: fileId, removed: true },
        true,
        now,
      );
      if (changed) {
        written += 1;
        tombstoned += 1;
      }
      return;
    }

    const batch = validateDriveFiles(file ? [file] : []);
    rejected += batch.rejected.length;
    for (const failure of batch.rejected) deps.onRejected?.('drive', failure);

    for (const valid of batch.valid) {
      const changed = await landRecord(db, ctx, connection.id, integrationId, 'file', valid.id, valid, false, now);
      if (changed) written += 1;
    }
  };

  try {
    const savedToken = cursors[DRIVE_CURSOR_KEY];

    if (savedToken) {
      let result;
      try {
        result = await listDriveChanges({ accessToken: token.accessToken, pageToken: savedToken, ...fetchOpt });
      } catch (error) {
        if (!(error instanceof SyncTokenExpiredError)) throw error;
        // The page token aged out; fall back to a full read and a fresh token.
        delete cursors[DRIVE_CURSOR_KEY];
        result = null;
      }

      if (result) {
        for (const change of result.changes) {
          await land(change.fileId, change.file, isDriveRemoval(change));
        }
        if (result.nextPageToken) cursors[DRIVE_CURSOR_KEY] = result.nextPageToken;
      }
    }

    // First sync, or recovery after an expired token: enumerate current files and
    // take a start token for next time.
    if (!cursors[DRIVE_CURSOR_KEY]) {
      // Grab the resume point BEFORE listing, so changes made mid-enumeration are
      // caught next run rather than falling in the gap between list and token.
      const startToken = await getDriveStartPageToken({ accessToken: token.accessToken, ...fetchOpt });
      const files = await listDriveFiles({ accessToken: token.accessToken, ...fetchOpt });
      for (const file of files) {
        await land(file.id, file, file.trashed === true);
      }
      if (startToken) cursors[DRIVE_CURSOR_KEY] = startToken;
    }
  } catch (error) {
    const transient = error instanceof GoogleTransientError;
    await saveProgress(db, ctx, integrationId, cursors, {
      status: transient ? 'connected' : 'error',
      errorReason: transient
        ? null
        : 'Kloyya could not read this Drive. It will try again; reconnect if this persists.',
    });
    return { ok: false, fetched, written, tombstoned, rejected, reason: transient ? 'transient' : 'failed' };
  }

  await saveProgress(db, ctx, integrationId, cursors, {
    status: 'connected',
    errorReason: null,
    syncedAt: now,
  });

  return { ok: true, fetched, written, tombstoned, rejected };
}

/**
 * Sync one Microsoft Graph delta resource (Outlook mail or calendar).
 *
 * Both Outlook connectors are the same shape — a delta feed whose cursor is an
 * @odata.deltaLink URL — so they share this and differ only in which lister and
 * resource type they pass. Microsoft rotates the refresh token on nearly every
 * refresh, which the token manager already persists; we just hand it Microsoft's
 * refresher and its own client credentials.
 */
async function syncGraphResource(
  db: AppDb,
  crypto: TokenCrypto,
  ctx: StartContext,
  deps: SyncDeps,
  config: {
    integrationId: string;
    resourceType: string;
    listDelta: (params: {
      accessToken: string;
      deltaLink?: string | undefined;
      fetchImpl?: typeof fetch;
    }) => Promise<{ items: { id: string }[]; removed: string[]; nextDeltaLink: string | null }>;
  },
): Promise<SyncOutcome> {
  const { integrationId, resourceType } = config;
  const now = new Date((deps.now ?? Date.now)());
  const fetchOpt = deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {};

  const connection = await readConnection(db, ctx, integrationId);
  if (!connection) {
    return { ok: false, fetched: 0, written: 0, tombstoned: 0, rejected: 0, reason: 'not_connected' };
  }

  const token = await getValidAccessToken(db, crypto, ctx, integrationId, {
    ...deps,
    // Microsoft's grant, refreshed the Microsoft way.
    refresh: refreshMicrosoftToken,
  });
  if (!token.ok) {
    return { ok: false, fetched: 0, written: 0, tombstoned: 0, rejected: 0, reason: token.reason };
  }

  await saveProgress(db, ctx, integrationId, connection.cursors, { status: 'syncing' });

  const cursors = { ...connection.cursors };
  let fetched = 0;
  let written = 0;
  let tombstoned = 0;
  let rejected = 0;

  try {
    const savedDelta = cursors[GRAPH_CURSOR_KEY];

    let result;
    try {
      result = await config.listDelta({ accessToken: token.accessToken, deltaLink: savedDelta, ...fetchOpt });
    } catch (error) {
      if (!(error instanceof SyncTokenExpiredError)) throw error;
      // The deltaLink aged out; drop it and read the current window whole.
      delete cursors[GRAPH_CURSOR_KEY];
      result = await config.listDelta({ accessToken: token.accessToken, deltaLink: undefined, ...fetchOpt });
    }

    // Tombstone the removals: an id and a tombstone are the whole record.
    for (const id of result.removed) {
      const changed = await landRecord(
        db,
        ctx,
        connection.id,
        integrationId,
        resourceType,
        id,
        { id, removed: true },
        true,
        now,
      );
      if (changed) {
        written += 1;
        tombstoned += 1;
      }
    }

    const batch = validateGraphItems(result.items);
    rejected += batch.rejected.length;
    for (const failure of batch.rejected) deps.onRejected?.(resourceType, failure);

    for (const item of batch.valid) {
      const changed = await landRecord(db, ctx, connection.id, integrationId, resourceType, item.id, item, false, now);
      if (changed) written += 1;
    }
    fetched = result.items.length + result.removed.length;

    if (result.nextDeltaLink) cursors[GRAPH_CURSOR_KEY] = result.nextDeltaLink;
  } catch (error) {
    const transient = error instanceof GraphTransientError;
    await saveProgress(db, ctx, integrationId, cursors, {
      status: transient ? 'connected' : 'error',
      errorReason: transient
        ? null
        : 'Kloyya could not read this Microsoft account. It will try again; reconnect if this persists.',
    });
    return { ok: false, fetched, written, tombstoned, rejected, reason: transient ? 'transient' : 'failed' };
  }

  await saveProgress(db, ctx, integrationId, cursors, { status: 'connected', errorReason: null, syncedAt: now });
  return { ok: true, fetched, written, tombstoned, rejected };
}

/** Outlook mail. */
export async function syncOutlookMail(
  db: AppDb,
  crypto: TokenCrypto,
  ctx: StartContext,
  deps: SyncDeps,
): Promise<SyncOutcome> {
  return syncGraphResource(db, crypto, ctx, deps, {
    integrationId: 'outlook',
    resourceType: 'message',
    listDelta: (params) => listOutlookMailDelta(params),
  });
}

/** Outlook calendar. */
export async function syncOutlookCalendar(
  db: AppDb,
  crypto: TokenCrypto,
  ctx: StartContext,
  deps: SyncDeps,
): Promise<SyncOutcome> {
  return syncGraphResource(db, crypto, ctx, deps, {
    integrationId: 'outlook_calendar',
    resourceType: 'calendar_event',
    listDelta: (params) =>
      listOutlookCalendarDelta({
        ...params,
        windowDays: FIRST_SYNC_WINDOW_DAYS,
        ...(deps.now ? { now: deps.now } : {}),
      }),
  });
}

/**
 * Sync a workspace's Notion.
 *
 * The same shape as the others — read incrementally, validate before storage,
 * advance the cursor only on success — but every incremental mechanism is
 * Notion's absence of one:
 *
 *  • No refresh. The token never expires, so we read it straight (getStaticAccessToken)
 *    rather than through the refresh manager. Revocation surfaces only as a 401 at
 *    call time, and that parks the connection like any other dead grant.
 *  • No changes feed. The cursor is a last_edited_time high-water mark; the client
 *    walks search newest-first and stops when it reaches something that old.
 *  • No deletion feed. An archived or trashed page simply carries a flag, which we
 *    tombstone — "this page was removed" is intelligence the same as any provider's.
 *
 * Pages and databases both come back from one search; each is landed under its own
 * resource type so the pipeline can tell a document from a table without reparsing.
 */
export async function syncNotion(
  db: AppDb,
  crypto: TokenCrypto,
  ctx: StartContext,
  deps: SyncDeps,
): Promise<SyncOutcome> {
  const integrationId = 'notion';
  const now = new Date((deps.now ?? Date.now)());
  const fetchOpt = deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {};

  const connection = await readConnection(db, ctx, integrationId);
  if (!connection) {
    return { ok: false, fetched: 0, written: 0, tombstoned: 0, rejected: 0, reason: 'not_connected' };
  }

  const token = await getStaticAccessToken(db, crypto, ctx, integrationId);
  if (!token.ok) {
    return { ok: false, fetched: 0, written: 0, tombstoned: 0, rejected: 0, reason: token.reason };
  }

  await saveProgress(db, ctx, integrationId, connection.cursors, { status: 'syncing' });

  const cursors = { ...connection.cursors };
  let fetched = 0;
  let written = 0;
  let tombstoned = 0;
  let rejected = 0;

  /** A Notion object is either a page or a database — keep them apart downstream. */
  const resourceTypeOf = (item: RawNotionItem): string =>
    item.object === 'database' ? 'notion_database' : 'notion_page';

  try {
    const since = cursors[NOTION_CURSOR_KEY];
    const page = await listNotionChanges({
      accessToken: token.accessToken,
      ...(since ? { since } : {}),
      ...fetchOpt,
    });
    fetched = page.items.length;

    // Split removals from live items: an archived/trashed page is a tombstone,
    // landed by id, and must not go through validation as a live record.
    const removals = page.items.filter(isNotionRemoval);
    const live = page.items.filter((item) => !isNotionRemoval(item));

    for (const item of removals) {
      const changed = await landRecord(
        db,
        ctx,
        connection.id,
        integrationId,
        resourceTypeOf(item),
        item.id,
        item,
        true,
        now,
      );
      if (changed) {
        written += 1;
        tombstoned += 1;
      }
    }

    const batch = validateNotionItems(live);
    rejected += batch.rejected.length;
    for (const failure of batch.rejected) deps.onRejected?.('notion', failure);

    for (const item of batch.valid) {
      const changed = await landRecord(
        db,
        ctx,
        connection.id,
        integrationId,
        resourceTypeOf(item),
        item.id,
        item,
        false,
        now,
      );
      if (changed) written += 1;
    }

    // Advance the high-water mark only if this run saw something newer — an empty
    // sync must not push the mark backward to null and re-read the world next time.
    if (page.newWatermark && (!since || page.newWatermark > since)) {
      cursors[NOTION_CURSOR_KEY] = page.newWatermark;
    }
  } catch (error) {
    if (error instanceof NotionUnauthorizedError) {
      // Notion gives no earlier signal; a 401 here is the revocation. Park it and
      // drop the dead token.
      await markRevoked(
        db,
        ctx,
        integrationId,
        'Notion no longer accepts this connection — the integration was removed in Notion. Reconnect to resume syncing.',
      );
      return { ok: false, fetched, written, tombstoned, rejected, reason: 'revoked' };
    }
    const transient = error instanceof NotionTransientError;
    await saveProgress(db, ctx, integrationId, cursors, {
      status: transient ? 'connected' : 'error',
      errorReason: transient
        ? null
        : 'Kloyya could not read this Notion workspace. It will try again; reconnect if this persists.',
    });
    return { ok: false, fetched, written, tombstoned, rejected, reason: transient ? 'transient' : 'failed' };
  }

  await saveProgress(db, ctx, integrationId, cursors, {
    status: 'connected',
    errorReason: null,
    syncedAt: now,
  });

  return { ok: true, fetched, written, tombstoned, rejected };
}
