import { and, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { connections, syncRecords } from '@kloyya/db/schema';
import type { Meeting, MeetingParticipant } from '@kloyya/core';
import { readEventTime, readEventTitle, readParticipants } from '../integrations/calendar-parse';
import { ApiError, API_STATUS } from '../http/errors';
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
 * empty/null: no meeting-intelligence pipeline exists yet to fill them in.
 * Same discipline as server/dashboard/service.ts's `toMeeting` — a null here
 * is honest; a fabricated agenda is the exact failure this module exists to
 * avoid. `getBriefing` always 404s for the same reason: nothing generates a
 * pre-meeting briefing yet, and that is a real "not yet", not a bug.
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

/** Always throws: no meeting-intelligence pipeline generates briefings yet. */
export async function getBriefing(_meetingId: string): Promise<never> {
  throw new ApiError({
    httpStatus: API_STATUS.NotFound,
    errorCode: 'briefing_not_available',
    message: 'No briefing exists for this meeting.',
    description: 'Kloyya does not generate pre-meeting briefings yet.',
    suggestedResolution: 'Check back once meeting briefings ship.',
  });
}
