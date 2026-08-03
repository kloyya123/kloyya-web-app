import { and, asc, eq, isNull, lt, or } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { connections } from '@kloyya/db/schema';
import type { AiProvider } from '../ai/provider';
import { generateBriefing } from '../briefing/service';
import type { TokenCrypto } from '../crypto/tokens';
import {
  syncGmail,
  syncGoogleCalendar,
  syncGoogleDrive,
  syncNotion,
  syncOutlookCalendar,
  syncOutlookMail,
  type SyncDeps,
  type SyncOutcome,
} from '../integrations/sync';
import type { StartContext } from '../tenant';

/**
 * Keeping every workspace's data fresh, on a schedule.
 *
 * Until this existed, sync ran exactly once — from the browser, immediately
 * after a tool was connected (see features/connections/use-first-sync.ts).
 * Nothing ever ran again. A user who connected Gmail on Monday had Monday's
 * mail on Friday, and the "morning briefing" was written whenever someone
 * happened to open the dashboard, from whatever had been landed days earlier.
 * A product that promises a briefing each morning has to do the reading each
 * morning.
 *
 * THE TENANT BOUNDARY, because this is the one place in the codebase that
 * legitimately crosses it. Finding which workspaces need syncing is a question
 * no single tenant can answer, so the enumeration below runs on the unscoped
 * `db` handle. Everything after it — every read, every write — goes through the
 * per-workspace sync functions, which each open their own `withTenantScope`.
 * The unscoped query selects ids and nothing else; no payload, no token, no
 * customer content is ever read outside a tenant scope.
 */

export type Syncer = (
  db: AppDb,
  crypto: TokenCrypto,
  ctx: StartContext,
  deps: SyncDeps,
) => Promise<SyncOutcome>;

/** The syncer for each integration id we can drive on a schedule. */
const DEFAULT_SYNCERS: Record<string, Syncer> = {
  google_calendar: syncGoogleCalendar,
  gmail: syncGmail,
  google_drive: syncGoogleDrive,
  outlook: syncOutlookMail,
  outlook_calendar: syncOutlookCalendar,
  notion: syncNotion,
};

/**
 * How stale a connection must be before the schedule picks it up.
 *
 * `vercel.json` fires this once a day at 06:00 UTC — Vercel's Hobby plan
 * rejects any cron expression that would run more than once daily, so hourly
 * is not available until the project is on Pro. 23 hours is slightly under
 * that cadence for the same reason an hourly job would shave a few minutes
 * off 60: a connection synced at 06:01 must still be eligible at tomorrow's
 * 06:00 run, or a slow deploy that delays one invocation by a few minutes
 * pushes every connection's effective cadence to two days instead of one.
 *
 * Raise the cron to hourly and this back down to under an hour together —
 * they are one cadence, not two independent numbers.
 */
const STALE_AFTER_MS = 23 * 60 * 60 * 1000;

/**
 * Connections processed per run.
 *
 * A cron invocation has a wall clock (see `maxDuration` on the route), and a
 * run that tries to sync every workspace at once gets killed partway through as
 * the customer base grows — losing the work AND leaving no record of how far it
 * got. Taking the stalest few hundred each time is self-levelling: whatever is
 * skipped is by definition the freshest, and it sorts to the front of the next
 * run.
 */
const MAX_CONNECTIONS_PER_RUN = 200;

export interface ScheduledSyncSummary {
  /** Connections the schedule attempted this run. */
  attempted: number;
  /** Connections whose sync reported success. */
  succeeded: number;
  /** Connections whose sync reported a failure. Never throws the run. */
  failed: number;
  /** Records written across every connection this run. */
  written: number;
  /** Workspaces a briefing was generated for. */
  briefed: number;
}

export interface SchedulerDeps {
  crypto: TokenCrypto;
  /** Google's client pair. Absent, Google connectors are skipped rather than failed. */
  googleClientId?: string | undefined;
  googleClientSecret?: string | undefined;
  /** Microsoft's client pair, same treatment. */
  microsoftClientId?: string | undefined;
  microsoftClientSecret?: string | undefined;
  /** Writes the morning briefing. Null skips briefing generation entirely. */
  aiProvider?: AiProvider | null;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Test seam: cap the work without waiting on a real clock. */
  maxConnections?: number;
  /**
   * Test seam: replace the real Gmail/Calendar/Drive/Notion/Graph syncers with
   * stubs. Merged over the defaults, so a test can override just one
   * integration id and every other connection is simply skipped rather than
   * hitting a real provider.
   */
  syncers?: Partial<Record<string, Syncer>>;
}

/** Which credential pair a connector needs, or none at all. */
function credentialsFor(
  integrationId: string,
  deps: SchedulerDeps,
): { clientId: string; clientSecret: string } | null {
  // Notion's token never expires, so it needs no client pair to refresh with.
  if (integrationId === 'notion') return { clientId: '', clientSecret: '' };

  const microsoft = integrationId === 'outlook' || integrationId === 'outlook_calendar';
  const clientId = microsoft ? deps.microsoftClientId : deps.googleClientId;
  const clientSecret = microsoft ? deps.microsoftClientSecret : deps.googleClientSecret;

  // Unconfigured is not the same as broken. A deployment without Microsoft
  // credentials should quietly not sync Outlook, not mark every Outlook
  // connection as failed on the hour, every hour.
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/**
 * Sync every workspace that has gone stale, then write their briefings.
 *
 * Never throws. One workspace's dead token, revoked grant, or rate-limited
 * provider must not stop the other nine hundred from syncing — each failure is
 * already recorded on its own connection row by the syncer, so the schedule's
 * job is to keep going and report totals.
 */
export async function runScheduledSync(
  db: AppDb,
  deps: SchedulerDeps,
): Promise<ScheduledSyncSummary> {
  const now = new Date((deps.now ?? Date.now)());
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MS);
  const limit = deps.maxConnections ?? MAX_CONNECTIONS_PER_RUN;

  /**
   * The unscoped enumeration — see the tenant-boundary note above.
   *
   * Only connections in a working state are candidates: `error` and `paused`
   * rows are excluded because retrying a revoked grant every hour would hammer
   * the provider and never succeed, and `syncing` is excluded so a run already
   * in flight is not started twice. `lastSyncedAt IS NULL` is included so a
   * connection whose first browser-driven sync never fired still gets picked up.
   */
  const due = await db
    .select({
      id: connections.id,
      organizationId: connections.organizationId,
      workspaceId: connections.workspaceId,
      integrationId: connections.integrationId,
      connectedByUserId: connections.connectedByUserId,
    })
    .from(connections)
    .where(
      and(
        eq(connections.status, 'connected'),
        or(isNull(connections.lastSyncedAt), lt(connections.lastSyncedAt, staleBefore)),
      ),
    )
    // Stalest first, so a backlog drains in the order people have been waiting.
    // NULLs sort first in Postgres ASC, which is what we want: never-synced
    // connections are the most overdue of all.
    .orderBy(asc(connections.lastSyncedAt))
    .limit(limit);

  const summary: ScheduledSyncSummary = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    written: 0,
    briefed: 0,
  };

  /** Workspaces touched this run, so each is briefed once rather than per tool. */
  const workspaces = new Map<string, StartContext>();
  const syncers = { ...DEFAULT_SYNCERS, ...deps.syncers };

  for (const connection of due) {
    const syncer = syncers[connection.integrationId];
    if (!syncer) continue;

    const credentials = credentialsFor(connection.integrationId, deps);
    if (!credentials) continue;

    // `connectedByUserId` can be null if that user was deleted; the sync path
    // never reads userId (it scopes by organization and workspace), so an empty
    // string is honest rather than inventing an id that resolves to nobody.
    const ctx: StartContext = {
      userId: connection.connectedByUserId ?? '',
      workspaceId: connection.workspaceId,
      organizationId: connection.organizationId,
    };

    summary.attempted += 1;
    try {
      const outcome = await syncer(db, deps.crypto, ctx, {
        ...credentials,
        ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
        ...(deps.now ? { now: deps.now } : {}),
      });

      if (outcome.ok) {
        summary.succeeded += 1;
        summary.written += outcome.written;
        workspaces.set(connection.workspaceId, ctx);
      } else {
        summary.failed += 1;
      }
    } catch (error) {
      // A syncer is supposed to convert its own failures into an outcome, so
      // reaching here means something genuinely unexpected. Log it and carry
      // on: one bad workspace must not end the run for everyone else.
      summary.failed += 1;
      console.error('[cron] sync threw', {
        integrationId: connection.integrationId,
        workspaceId: connection.workspaceId,
        error,
      });
    }
  }

  // Briefings last, so each is written from data this run has already landed
  // rather than from yesterday's. Only workspaces that actually synced are
  // briefed — nothing new arrived anywhere else.
  if (deps.aiProvider) {
    for (const ctx of workspaces.values()) {
      try {
        const briefing = await generateBriefing(db, ctx, deps.aiProvider, now);
        if (briefing) summary.briefed += 1;
      } catch (error) {
        console.error('[cron] briefing threw', { workspaceId: ctx.workspaceId, error });
      }
    }
  }

  return summary;
}
