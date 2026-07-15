import type { IsoTimestamp, Score } from './domain.js';

/**
 * The calendar domain.
 *
 * A `CalendarEvent` is a block of committed time; a `Meeting` (types/domain.ts)
 * is the intelligence attached to one. An event of kind 'meeting' may point at
 * its Meeting via `meetingId`, but the calendar renders fine without one — a
 * synced Google Calendar event has committed time long before Kloyya has built
 * an agenda for it.
 */

export const EVENT_KINDS = ['meeting', 'focus', 'personal'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export interface CalendarEvent {
  id: string;
  title: string;
  kind: EventKind;
  startsAt: IsoTimestamp;
  endsAt: IsoTimestamp;
  /** Present when this block is a Meeting entity with intelligence attached. */
  meetingId?: string;
  /** Display names. Kept flat — the calendar never needs the full participant. */
  attendees?: string[];
}

/** Two meetings claiming the same minutes. Always exactly a pair. */
export interface EventConflict {
  eventIds: [string, string];
  overlapMinutes: number;
}

/** An open stretch inside working hours. */
export interface FreeSlot {
  startsAt: IsoTimestamp;
  endsAt: IsoTimestamp;
  minutes: number;
}

/**
 * A focus-time proposal. Golden Rules: it carries its reason and its
 * confidence, never a bare time range.
 */
export interface FocusSuggestion {
  slot: FreeSlot;
  reason: string;
  confidence: Score;
}

export type CalendarViewKind = 'day' | 'week';

/** Everything one calendar request returns. */
export interface Schedule {
  /** The events inside the requested range, sorted by start. */
  events: CalendarEvent[];
  /** Detected double-bookings within the range. */
  conflicts: EventConflict[];
  /** Open stretches for the *anchor day* (suggestions are daily, not weekly). */
  freeSlots: FreeSlot[];
  focusSuggestions: FocusSuggestion[];
}
