import { and, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { syncRecords } from '@kloyya/db/schema';
import {
  addDaysUtc,
  findConflicts,
  findFreeSlots,
  startOfWeekUtc,
  suggestFocusTime,
  type WorkdayWindow,
} from '@/lib/calendar-math';
import type { CalendarEvent, FreeSlot, Schedule } from '@/types/calendar';
import { readEventTime, readEventTitle, readParticipants } from '../integrations/calendar-parse';
import type { StartContext } from '../tenant';
import { ApiError, API_STATUS } from '../http/errors';

/**
 * Calendar, built from the workspace's own synced events.
 *
 * `sync_records` rows with `resourceType = 'calendar_event'` are the only
 * source — the same rows the dashboard's `upcomingMeetings` reads (see
 * server/dashboard/service.ts). The intelligence on top (conflicts, free
 * slots, focus suggestions) is the exact pure logic in lib/calendar-math.ts
 * the mock has always used, so the logic under test is the logic that ships.
 *
 * A synced event carries no explicit "kind": a real Google/Graph event is
 * either a meeting (it has other attendees) or personal time (it does not).
 * `focus` is reserved for blocks Kloyya itself holds — none exist from this
 * read path today, since `holdFocusTime` has no write path yet (see below).
 */

const WORKDAY: WorkdayWindow = { dayStartHour: 8, dayEndHour: 18 };
const MIN_SLOT_MINUTES = 30;
/** Generous enough for a week of a busy calendar without an unbounded scan. */
const EVENT_ROW_LIMIT = 1000;

function toCalendarEvent(row: { externalId: string; payload: unknown }): CalendarEvent | null {
  if (!row.payload || typeof row.payload !== 'object') return null;
  const payload = row.payload as Record<string, unknown>;

  const title = readEventTitle(payload);
  const startsAt = readEventTime(payload['start']);
  if (!title || !startsAt) return null;

  const endsAt = readEventTime(payload['end']) ?? new Date(new Date(startsAt).getTime() + 3_600_000).toISOString();

  const participants = readParticipants(payload);
  const kind = participants.length > 0 ? 'meeting' : 'personal';

  return {
    id: row.externalId,
    title,
    kind,
    startsAt,
    endsAt,
    ...(kind === 'meeting' ? { meetingId: row.externalId } : {}),
    ...(participants.length > 0 ? { attendees: participants.map((p) => p.fullName) } : {}),
  };
}

export interface GetScheduleQuery {
  /** Anchor day, "YYYY-MM-DD". Week view expands to that day's Mon-Sun. */
  date: string;
  view: 'day' | 'week';
}

export async function getSchedule(db: AppDb, ctx: StartContext, query: GetScheduleQuery): Promise<Schedule> {
  const days =
    query.view === 'week'
      ? Array.from({ length: 7 }, (_, index) => addDaysUtc(startOfWeekUtc(query.date), index))
      : [query.date];
  const rangeStart = `${days[0]}T00:00:00.000Z`;
  const rangeEndExclusive = `${addDaysUtc(days[days.length - 1]!, 1)}T00:00:00.000Z`;

  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select({ externalId: syncRecords.externalId, payload: syncRecords.payload })
      .from(syncRecords)
      .where(
        and(
          eq(syncRecords.workspaceId, ctx.workspaceId),
          eq(syncRecords.resourceType, 'calendar_event'),
          isNull(syncRecords.deletedAtSource),
        ),
      )
      .limit(EVENT_ROW_LIMIT),
  );

  const allEvents = rows.map(toCalendarEvent).filter((e): e is CalendarEvent => e !== null);

  const events = allEvents
    .filter((e) => e.startsAt < rangeEndExclusive && e.endsAt > rangeStart)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  // Suggestions anchor to the requested day: "where could focus go *today*" is
  // a daily question even when the grid shows the week.
  const anchorDayEvents = allEvents.filter((e) => e.startsAt.slice(0, 10) === query.date);
  const freeSlots = findFreeSlots(anchorDayEvents, query.date, WORKDAY, MIN_SLOT_MINUTES);

  return {
    events,
    conflicts: findConflicts(events),
    freeSlots,
    // An empty day needs no focus suggestion — there is nothing to defend the
    // time against, and suggesting work on a weekend is noise.
    focusSuggestions: anchorDayEvents.length === 0 ? [] : suggestFocusTime(freeSlots),
  };
}

/**
 * Committing a suggested slot as held focus time means writing a new event
 * back to the user's actual Google/Microsoft calendar — there is no such
 * write path in the connectors yet (server/integrations/google-calendar.ts
 * and -outlook.ts are read/sync only). Rather than silently no-op or fake a
 * local-only "held" event that vanishes on the next sync, this says so
 * plainly: a 501 the client can render as "not available yet", not a 500 that
 * reads as broken.
 */
export async function holdFocusTime(_slot: FreeSlot): Promise<never> {
  throw new ApiError({
    httpStatus: API_STATUS.ServiceUnavailable,
    errorCode: 'focus_time_not_supported',
    message: 'Holding focus time is not available yet.',
    description: 'Kloyya can read your calendar, but cannot write a new event to it yet.',
    suggestedResolution: 'Block the time directly in Google Calendar or Outlook for now.',
  });
}
