import type {
  CalendarEvent,
  EventConflict,
  FocusSuggestion,
  FreeSlot,
} from '@/types/calendar';

/**
 * The calendar's algorithmic core, as pure functions.
 *
 * Conflict detection, free-slot finding, focus scoring, and lane assignment are
 * the intelligence of this feature — and none of it touches React or the
 * service layer, so all of it is unit-tested here and moves server-side
 * unchanged when the real Google/Microsoft connectors land.
 *
 * All date math is UTC. Dates cross the app as ISO strings; doing interval
 * arithmetic in local time is how an event silently shifts a day at a timezone
 * boundary.
 */

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

interface Interval {
  start: number;
  end: number;
}

function toInterval(event: CalendarEvent): Interval {
  return { start: Date.parse(event.startsAt), end: Date.parse(event.endsAt) };
}

/**
 * Every pair of meetings that overlap, ordered by the earlier event's start.
 *
 * Only meeting-vs-meeting counts: the spec's "Meeting Conflicts" means a
 * double-booking. Touching endpoints (end === start) are back-to-back, not
 * conflicting.
 */
export function findConflicts(events: CalendarEvent[]): EventConflict[] {
  const meetings = events
    .filter((event) => event.kind === 'meeting')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const conflicts: EventConflict[] = [];

  for (let i = 0; i < meetings.length; i++) {
    const a = toInterval(meetings[i]!);
    for (let j = i + 1; j < meetings.length; j++) {
      const b = toInterval(meetings[j]!);
      // Sorted by start, so once b starts after a ends, no later event overlaps a.
      if (b.start >= a.end) break;

      const overlap = Math.min(a.end, b.end) - b.start;
      if (overlap > 0) {
        conflicts.push({
          eventIds: [meetings[i]!.id, meetings[j]!.id],
          overlapMinutes: Math.round(overlap / MINUTE_MS),
        });
      }
    }
  }

  return conflicts;
}

export interface WorkdayWindow {
  /** UTC hour the workday opens, e.g. 8. */
  dayStartHour: number;
  /** UTC hour it closes, e.g. 18. */
  dayEndHour: number;
}

/**
 * The open stretches of a given day ("YYYY-MM-DD"), inside the workday window,
 * at least `minMinutes` long.
 *
 * Every event kind counts as busy — held focus time is a commitment, and a
 * suggestion that double-books it would teach the user to ignore suggestions.
 */
export function findFreeSlots(
  events: CalendarEvent[],
  date: string,
  window: WorkdayWindow,
  minMinutes: number,
): FreeSlot[] {
  const dayStart = Date.parse(`${date}T00:00:00.000Z`) + window.dayStartHour * 60 * MINUTE_MS;
  const dayEnd = Date.parse(`${date}T00:00:00.000Z`) + window.dayEndHour * 60 * MINUTE_MS;

  // Clamp to the window, drop what falls entirely outside, merge overlaps.
  const busy = events
    .map(toInterval)
    .map((interval) => ({
      start: Math.max(interval.start, dayStart),
      end: Math.min(interval.end, dayEnd),
    }))
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);

  const merged: Interval[] = [];
  for (const interval of busy) {
    const last = merged.at(-1);
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }

  // The gaps between merged busy blocks are the free slots.
  const slots: FreeSlot[] = [];
  let cursor = dayStart;
  for (const interval of [...merged, { start: dayEnd, end: dayEnd }]) {
    const minutes = Math.round((interval.start - cursor) / MINUTE_MS);
    if (minutes >= minMinutes) {
      slots.push({
        startsAt: new Date(cursor).toISOString(),
        endsAt: new Date(interval.start).toISOString(),
        minutes,
      });
    }
    cursor = Math.max(cursor, interval.end);
  }

  return slots;
}

/** Deep work stops deepening past two hours; suggest a block, not a morning. */
const MAX_FOCUS_MINUTES = 120;

/**
 * Turn free slots into focus-time proposals, best first.
 *
 * Confidence is derived from slot length — a 2-hour stretch is a safer bet for
 * deep work than 30 loose minutes — and capped below certainty, because a mock
 * (and even a real model) cannot know what today will actually do.
 */
export function suggestFocusTime(slots: FreeSlot[]): FocusSuggestion[] {
  return [...slots]
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 2)
    .map((slot) => {
      const minutes = Math.min(slot.minutes, MAX_FOCUS_MINUTES);
      const startMs = Date.parse(slot.startsAt);
      const trimmed: FreeSlot = {
        startsAt: slot.startsAt,
        endsAt: new Date(startMs + minutes * MINUTE_MS).toISOString(),
        minutes,
      };

      const isMorning = new Date(startMs).getUTCHours() < 12;
      const reason =
        minutes >= 90
          ? `${minutes} uninterrupted minutes${isMorning ? ' before the afternoon fills up' : ' with nothing scheduled against it'}.`
          : `A ${minutes}-minute gap — enough for one focused task.`;

      return {
        slot: trimmed,
        reason,
        // 30 free minutes ≈ 60; 2+ hours ≈ 95. Linear in between, never certain.
        confidence: Math.min(95, Math.round(48 + minutes * 0.4)),
      };
    });
}

export interface LanePosition {
  lane: number;
  laneCount: number;
}

/**
 * Assign overlapping events to side-by-side lanes for rendering.
 *
 * Greedy sweep: each event takes the first lane whose previous occupant has
 * ended. Events in the same overlap cluster share a `laneCount`, so each block
 * knows what fraction of the column width it may claim.
 */
export function assignLanes(events: CalendarEvent[]): Map<string, LanePosition> {
  const sorted = [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const positions = new Map<string, LanePosition>();

  let cluster: { id: string; end: number; lane: number }[] = [];
  let laneEnds: number[] = [];

  const closeCluster = () => {
    for (const member of cluster) {
      positions.set(member.id, { lane: member.lane, laneCount: laneEnds.length });
    }
    cluster = [];
    laneEnds = [];
  };

  for (const event of sorted) {
    const { start, end } = toInterval(event);

    // No lane still runs into this event ⇒ the previous cluster is finished.
    if (laneEnds.length > 0 && laneEnds.every((laneEnd) => laneEnd <= start)) {
      closeCluster();
    }

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    cluster.push({ id: event.id, end, lane });
  }
  closeCluster();

  return positions;
}

// ---------------------------------------------------------------------------
// UTC date helpers — "YYYY-MM-DD" in, "YYYY-MM-DD" out.
// ---------------------------------------------------------------------------

export function addDaysUtc(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Monday of the week containing `date`. */
export function startOfWeekUtc(date: string): string {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const sinceMonday = (day + 6) % 7;
  return addDaysUtc(date, -sinceMonday);
}

/** Today as "YYYY-MM-DD" (UTC). */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Guard for the ?date= URL param. Garbage in, today out — never a crash. */
export function parseDateParam(raw: string | undefined | null): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(`${raw}T00:00:00.000Z`))) {
    return raw;
  }
  return todayUtc();
}
