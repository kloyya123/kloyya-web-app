import { eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { connections } from '@kloyya/db/schema';
import type { EvidenceSourceType } from '@kloyya/core';
import type {
  ConnectedSource,
  IntelligenceHealth,
  SourceCategory,
  SourceProvider,
  SourceStatus,
} from '@kloyya/core/sources';
import { clampScore } from '@/lib/decision-score';
import { ApiError, API_STATUS } from '../http/errors';
import type { StartContext } from '../tenant';

/**
 * The real Sources / Intelligence Transparency service, built from the
 * workspace's own `connections` rows.
 *
 * Deliberately narrower than the full `SOURCE_PROVIDERS` catalogue: that list
 * also names providers with no connector at all (OneDrive, Salesforce, Jira,
 * GitHub, Microsoft Teams/Calendar) and three "AI intelligence" sources
 * (organization_memory, knowledge_graph, context_engine) that no pipeline in
 * this codebase produces yet. Listing them as connected sources would be
 * inventing infrastructure, not reporting it — so this only ever reports the
 * providers Kloyya can actually connect to and sync today.
 *
 * `getSourceUsage`/`getCoverage` explain a *recommendation*'s retrieval
 * decisions — and no recommendation pipeline exists yet (every real
 * dashboard's `recommendations` list is `[]`). Both throw 404 for every id,
 * honestly: there is no recommendation to explain, the same way the mock
 * already 404s for an id it has never seen.
 */

interface RealProviderMeta {
  displayName: string;
  category: SourceCategory;
  evidenceType: EvidenceSourceType;
}

/** Only providers with a real connector. See module doc for why this is narrower than SOURCE_PROVIDERS. */
const REAL_PROVIDERS: Partial<Record<SourceProvider, RealProviderMeta>> = {
  gmail: { displayName: 'Gmail', category: 'personal', evidenceType: 'email' },
  google_calendar: { displayName: 'Google Calendar', category: 'personal', evidenceType: 'calendar' },
  google_drive: { displayName: 'Google Drive', category: 'organization', evidenceType: 'document' },
  notion: { displayName: 'Notion', category: 'organization', evidenceType: 'document' },
  slack: { displayName: 'Slack', category: 'organization', evidenceType: 'chat' },
};

const WORKING: ReadonlySet<SourceStatus> = new Set<SourceStatus>(['healthy', 'syncing']);

function toSourceStatus(status: string): SourceStatus {
  switch (status) {
    case 'connected':
      return 'healthy';
    case 'syncing':
      return 'syncing';
    case 'error':
      return 'needs_attention';
    case 'paused':
      return 'needs_attention';
    default:
      return 'disconnected';
  }
}

/**
 * Freshness from real elapsed time since the last sync — 100% at 0 minutes,
 * decaying to 0% by 24 hours (the sync cadence's own staleness window, see
 * server/sync/scheduler.ts's STALE_AFTER_MS).
 */
function freshnessFrom(lastSyncedAt: Date | null): number {
  if (!lastSyncedAt) return 0;
  const minutesSince = (Date.now() - lastSyncedAt.getTime()) / 60_000;
  return Math.round(clampScore(100 - (minutesSince / (24 * 60)) * 100));
}

/**
 * Confidence as a deterministic function of connection status — there is no
 * live per-source accuracy signal to measure, so this reports what IS known
 * (is the connection actually working) rather than inventing a number.
 */
function confidenceFrom(status: SourceStatus): number {
  switch (status) {
    case 'healthy':
      return 90;
    case 'syncing':
      return 70;
    case 'needs_attention':
    case 'token_expired':
      return 30;
    case 'disconnected':
      return 0;
  }
}

async function loadSources(db: AppDb, ctx: StartContext): Promise<ConnectedSource[]> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select({
        id: connections.id,
        integrationId: connections.integrationId,
        status: connections.status,
        lastSyncedAt: connections.lastSyncedAt,
        errorReason: connections.errorReason,
      })
      .from(connections)
      .where(eq(connections.workspaceId, ctx.workspaceId)),
  );

  const sources: ConnectedSource[] = [];
  for (const row of rows) {
    const meta = REAL_PROVIDERS[row.integrationId as SourceProvider];
    if (!meta) continue; // Not a provider this service reports on. See module doc.

    const status = toSourceStatus(row.status);
    sources.push({
      id: row.id,
      provider: row.integrationId as SourceProvider,
      displayName: meta.displayName,
      category: meta.category,
      evidenceType: meta.evidenceType,
      status,
      // Every real connector is read-only today — no connector has a write
      // path yet (see server/calendar/service.ts's holdFocusTime for the
      // same honesty on the calendar side).
      permission: 'read_only',
      freshness: freshnessFrom(row.lastSyncedAt),
      confidence: confidenceFrom(status),
      lastSyncedAt: (row.lastSyncedAt ?? new Date(0)).toISOString(),
      // No recommendation pipeline exists yet — nothing cites a source yet.
      referencedByCount: 0,
      ...(row.errorReason ? { attentionReason: row.errorReason } : {}),
    });
  }
  return sources;
}

export async function listSources(
  db: AppDb,
  ctx: StartContext,
  category?: SourceCategory,
): Promise<ConnectedSource[]> {
  const sources = await loadSources(db, ctx);
  return category ? sources.filter((s) => s.category === category) : sources;
}

export async function getHealth(db: AppDb, ctx: StartContext): Promise<IntelligenceHealth> {
  const sources = await loadSources(db, ctx);
  const total = sources.length;
  const working = sources.filter((s) => WORKING.has(s.status));
  const needsAttention = total - working.length;

  const coverage =
    total === 0 ? 0 : (working.reduce((sum, s) => sum + s.confidence, 0) / (total * 100)) * 100;

  const avgFreshnessPct =
    working.length === 0 ? 0 : working.reduce((sum, s) => sum + s.freshness, 0) / working.length;
  const averageFreshnessMinutes = Math.round(((100 - avgFreshnessPct) / 100) * 60);

  return {
    totalSources: total,
    healthy: working.length,
    needsAttention,
    knowledgeCoverage: Math.round(clampScore(coverage)),
    averageFreshnessMinutes,
    // Neither has a real signal yet — no recommendation pipeline, no live
    // accuracy telemetry. Zero is the honest reading; a plausible-looking
    // number here would be indistinguishable from a real one on screen.
    recommendationConfidence: 0,
    aiAccuracy: 0,
  };
}

/** Always throws: no recommendation pipeline exists to explain retrieval decisions for. */
export async function getSourceUsage(_recommendationId: string): Promise<never> {
  throw recommendationNotFound();
}

/** Always throws, for the same reason as getSourceUsage. */
export async function getCoverage(_recommendationId: string): Promise<never> {
  throw recommendationNotFound();
}

function recommendationNotFound(): ApiError {
  return new ApiError({
    httpStatus: API_STATUS.NotFound,
    errorCode: 'recommendation_not_found',
    message: 'That recommendation no longer exists.',
    description: 'Kloyya does not generate recommendations yet.',
    suggestedResolution: 'Check back once the recommendations feature ships.',
  });
}
