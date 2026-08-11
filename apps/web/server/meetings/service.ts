import { and, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { connections, syncRecords } from '@kloyya/db/schema';
import type { Meeting, MeetingBriefing, MeetingParticipant } from '@kloyya/core';
import type { AiProvider } from '../ai/provider';
import { readEventTime, readEventTitle, readParticipants } from '../integrations/calendar-parse';
import { ApiError, API_STATUS } from '../http/errors';
import { generateMeetingBriefing } from './briefing';
import type { StartContext } from '../tenant';

export interface MeetingList {
  /** Soonest first. */
  upcoming: Meeting[];
  /** Most recent first. */
  past: Meeting[];
}

/**
 * Meetings, built from the same synced calendar events the Calendar feature
 * reads (see server/calendar/service.ts) — there is no separate "meeting"
 * table. A `Meeting` here is a `calendar_event` sync record reshaped to the
 * client's contract.
 *
 * `summary`, `agenda`, `actionItems`, `decisions` and `followUps` are always
 * empty/null: no post-meeting summarization pipeline exists yet to fill them
 * in. Same discipline as server/dashboard/service.ts's `toMeeting` — a null
 * here is honest; a fabricated summary is the exact failure this module
 * exists to avoid. `getBriefing` is real (see ./briefing.ts): it retrieves
 * genuine evidence for the meeting and asks the model to reason over it, or
 * 404s when there is nothing yet to build one from.
 */

const EVENT_ROW_LIMIT = 500;

type MeetingRow = {
  externalId: string;
  payload: unknown;
  fetchedAt: Date;
  connectedByUserId: string | null;
};

function toParticipants(
  raw: { userId: string; fullName: string }[],
): MeetingParticipant[] {
  return raw.map((p) => ({ userId: p.userId, fullName: p.fullName }));
}

function toMeeting(row: MeetingRow, ctx: StartContext): Meeting | null {
  if (!row.payload || typeof row.payload !== 'object') return null;
  const payload = row.payload as Record<string, unknown>;

  const title = readEventTitle(payload);
  const startsAt = readEventTime(payload['start']);
  if (!title || !startsAt) return null;

  const endsAt = readEventTime(payload['end']) ?? new Date(new Date(startsAt).getTime() + 3_600_000).toISOString();
  const fetched = row.fetchedAt.toISOString();

  return {
    id: row.externalId,
    organizationId: ctx.organizationId,
    workspaceId: ctx.workspaceId,
    // The connection's owner, not a Kloyya-side author — nobody "created" a
    // synced event inside Kloyya. The closest honest attribution.
    createdBy: row.connectedByUserId ?? ctx.userId,
    updatedBy: row.connectedByUserId ?? ctx.userId,
    title,
    startsAt,
    endsAt,
    participants: toParticipants(readParticipants(payload)),
    summary: null,
    agenda: [],
    actionItems: [],
    decisions: [],
    followUps: [],
    summaryConfidence: null,
    createdAt: fetched,
    updatedAt: fetched,
    // Nothing landed is synced-record data has no versioning concept.
    version: 1,
  };
}

async function loadMeetingRows(db: AppDb, ctx: StartContext): Promise<MeetingRow[]> {
  return withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select({
        externalId: syncRecords.externalId,
        payload: syncRecords.payload,
        fetchedAt: syncRecords.fetchedAt,
        connectedByUserId: connections.connectedByUserId,
      })
      .from(syncRecords)
      .leftJoin(connections, eq(syncRecords.connectionId, connections.id))
      .where(
        and(
          eq(syncRecords.workspaceId, ctx.workspaceId),
          eq(syncRecords.resourceType, 'calendar_event'),
          isNull(syncRecords.deletedAtSource),
        ),
      )
      .limit(EVENT_ROW_LIMIT),
  );
}

export async function listMeetings(db: AppDb, ctx: StartContext, now: Date = new Date()): Promise<MeetingList> {
  const rows = await loadMeetingRows(db, ctx);
  const meetings = rows.map((row) => toMeeting(row, ctx)).filter((m): m is Meeting => m !== null);
  const nowMs = now.getTime();

  return {
    upcoming: meetings
      .filter((m) => Date.parse(m.startsAt) > nowMs)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    past: meetings
      .filter((m) => Date.parse(m.startsAt) <= nowMs)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
  };
}

export async function getMeeting(db: AppDb, ctx: StartContext, id: string): Promise<Meeting | null> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select({
        externalId: syncRecords.externalId,
        payload: syncRecords.payload,
        fetchedAt: syncRecords.fetchedAt,
        connectedByUserId: connections.connectedByUserId,
      })
      .from(syncRecords)
      .leftJoin(connections, eq(syncRecords.connectionId, connections.id))
      .where(
        and(
          eq(syncRecords.workspaceId, ctx.workspaceId),
          eq(syncRecords.resourceType, 'calendar_event'),
          eq(syncRecords.externalId, id),
          isNull(syncRecords.deletedAtSource),
        ),
      )
      .limit(1),
  );
  return rows[0] ? toMeeting(rows[0], ctx) : null;
}

/**
 * The pre-meeting briefing, generated (or read from cache) from genuine
 * evidence about this specific meeting. Throws 404 both for an unknown
 * meeting and for a real one with nothing yet to build a briefing from — the
 * client cannot and should not tell those apart; either way there is nothing
 * to show.
 */
export async function getBriefing(
  db: AppDb,
  ctx: StartContext,
  provider: AiProvider | null,
  meetingId: string,
  now: Date = new Date(),
): Promise<MeetingBriefing> {
  const meeting = await getMeeting(db, ctx, meetingId);
  if (!meeting) {
    throw new ApiError({
      httpStatus: API_STATUS.NotFound,
      errorCode: 'meeting_not_found',
      message: 'That meeting no longer exists.',
      description: 'It may have been cancelled, or the link may be out of date.',
      suggestedResolution: 'Go back to your meetings list for the current schedule.',
    });
  }

  const briefing = await generateMeetingBriefing(db, ctx, provider, meeting, now);
  if (!briefing) {
    throw new ApiError({
      httpStatus: API_STATUS.NotFound,
      errorCode: 'briefing_not_available',
      message: 'No briefing exists for this meeting.',
      description: 'Briefings are prepared for upcoming meetings that need one, from evidence Kloyya has actually seen.',
      suggestedResolution: 'Past meetings carry a summary instead.',
    });
  }
  return briefing;
}
