import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { syncRecords, tasks } from '@kloyya/db/schema';
import type { Briefing } from '@kloyya/core';
import type { AiProvider } from '../ai/provider';
import { generateBriefing } from '../briefing/service';
import { readEventTime, readEventTitle, readParticipants } from '../integrations/calendar-parse';
import type { StartContext } from '../tenant';

/**
 * The dashboard, built from the workspace's own data.
 *
 * Until now `services.intelligence` was pinned to the mock implementation
 * regardless of NEXT_PUBLIC_USE_REAL_API, so every real user's dashboard showed
 * the demo fixture — Northwind's projects, Atlas's deadline, meetings with
 * people who do not exist. Plausible-looking numbers that belong to nobody are
 * worse than an empty state: an empty dashboard tells the truth.
 *
 * WHAT IS REAL HERE, and what is deliberately still empty.
 *
 * Real, because the data exists:
 *   priorities      — the workspace's own tasks, ranked by AI priority score
 *   upcomingMeetings— calendar events landed by the Google Calendar connector
 *   metrics         — counted from those two
 *   briefing        — written from what actually landed in the last day
 *
 * The briefing matters more than its size suggests. Until it existed this file
 * queried only `calendar_event`, so a workspace could sync thousands of emails,
 * files and Notion pages and still render a blank screen — sync reported success
 * and nothing the user connected was anywhere on the page. See briefing/service.
 *
 * Empty, because no backend produces them yet:
 *   recommendations, agents, notifications, projects
 *
 * Returning [] for those is the honest answer, and every consumer already
 * renders an empty state for it — the alternative would be inventing content
 * and calling it intelligence. They fill in when their pipelines land; the
 * shape does not change.
 */

/** Matches the client's `Meeting`, minus the fields no connector can supply. */
export interface DashboardMeeting {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  participants: { userId: string; fullName: string }[];
  summary: string | null;
  agenda: string[];
  actionItems: string[];
  decisions: string[];
  followUps: string[];
  summaryConfidence: null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardPayload {
  briefing: Briefing | null;
  recommendations: never[];
  priorities: unknown[];
  projects: never[];
  upcomingMeetings: DashboardMeeting[];
  agents: never[];
  notifications: never[];
  metrics: {
    openTasks: number;
    meetingsToday: number;
    projectsAtRisk: number;
    trustScore: number;
  };
}

/** The most tasks the dashboard's priority list shows. */
const PRIORITY_LIMIT = 10;
/** How far ahead "upcoming" reaches. */
const MEETING_WINDOW_HOURS = 24;

/**
 * Turn a landed calendar record into the shape the dashboard renders.
 * Returns null for anything without a usable title and start time.
 */
function toMeeting(row: {
  externalId: string;
  payload: unknown;
  fetchedAt: Date;
}): DashboardMeeting | null {
  if (!row.payload || typeof row.payload !== 'object') return null;
  const payload = row.payload as Record<string, unknown>;

  const title = readEventTitle(payload);
  const startsAt = readEventTime(payload['start']);
  if (!title || !startsAt) return null;

  // A missing end is common on all-day events; assume an hour rather than
  // dropping an event the user can see in their own calendar.
  const endsAt = readEventTime(payload['end']) ?? new Date(new Date(startsAt).getTime() + 3_600_000).toISOString();

  const fetched = row.fetchedAt.toISOString();
  return {
    id: row.externalId,
    title,
    startsAt,
    endsAt,
    participants: readParticipants(payload),
    // Kloyya does not generate meeting summaries yet. Null says so; a fabricated
    // one would be the exact failure this module exists to end.
    summary: null,
    agenda: [],
    actionItems: [],
    decisions: [],
    followUps: [],
    summaryConfidence: null,
    createdAt: fetched,
    updatedAt: fetched,
  };
}

export async function getDashboard(
  db: AppDb,
  ctx: StartContext,
  now: Date = new Date(),
  provider: AiProvider | null = null,
): Promise<DashboardPayload> {
  const windowEnd = new Date(now.getTime() + MEETING_WINDOW_HOURS * 3_600_000);

  // Started before the queries below and awaited after them, so the model call
  // overlaps the database work instead of following it. It never rejects — a
  // briefing that cannot be written is null, not a failed dashboard.
  const briefingPromise = generateBriefing(db, ctx, provider, now);

  const payload = await withTenantScope(db, ctx.organizationId, async (tx) => {
    const [taskRows, openCountRow, eventRows] = await Promise.all([
      tx
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          priority: tasks.priority,
          ownerId: tasks.ownerId,
          projectId: tasks.projectId,
          dueAt: tasks.dueAt,
          aiPriorityScore: tasks.aiPriorityScore,
          createdAt: tasks.createdAt,
          updatedAt: tasks.updatedAt,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.workspaceId, ctx.workspaceId),
            isNull(tasks.deletedAt),
            sql`${tasks.status} <> 'done'`,
          ),
        )
        .orderBy(desc(tasks.aiPriorityScore), desc(tasks.createdAt))
        .limit(PRIORITY_LIMIT),

      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(
          and(
            eq(tasks.workspaceId, ctx.workspaceId),
            isNull(tasks.deletedAt),
            sql`${tasks.status} <> 'done'`,
          ),
        )
        .then((rows) => rows[0]),

      // Provider-agnostic: both calendar connectors land `calendar_event`.
      // Tombstoned rows are excluded — a cancelled meeting is not upcoming.
      tx
        .select({
          externalId: syncRecords.externalId,
          payload: syncRecords.payload,
          fetchedAt: syncRecords.fetchedAt,
        })
        .from(syncRecords)
        .where(
          and(
            eq(syncRecords.workspaceId, ctx.workspaceId),
            eq(syncRecords.resourceType, 'calendar_event'),
            isNull(syncRecords.deletedAtSource),
          ),
        )
        .limit(500),
    ]);

    // The time filter is applied here rather than in SQL: the timestamp lives
    // inside provider JSON whose shape differs per connector, so parsing it in
    // Postgres would mean a different expression per provider. 500 rows is a
    // trivial amount to filter in memory, and it keeps one code path.
    const upcomingMeetings = eventRows
      .map(toMeeting)
      .filter((m): m is DashboardMeeting => m !== null)
      .filter((m) => {
        const start = new Date(m.startsAt).getTime();
        return start >= now.getTime() && start <= windowEnd.getTime();
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
    const meetingsToday = upcomingMeetings.filter((m) => {
      const start = new Date(m.startsAt).getTime();
      return start >= startOfDay.getTime() && start < endOfDay.getTime();
    }).length;

    return {
      briefing: null as Briefing | null,
      recommendations: [],
      priorities: taskRows.map((task) => ({
        ...task,
        dueAt: task.dueAt?.toISOString(),
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      })),
      projects: [],
      upcomingMeetings,
      agents: [],
      notifications: [],
      metrics: {
        openTasks: openCountRow?.count ?? 0,
        meetingsToday,
        // No project pipeline and no Trust Score computation yet. Zero is the
        // honest reading; a number invented here would be indistinguishable
        // from a real one on screen.
        projectsAtRisk: 0,
        trustScore: 0,
      },
    } satisfies DashboardPayload;
  });

  return { ...payload, briefing: await briefingPromise };
}
