import {
  addDaysUtc,
  findConflicts,
  findFreeSlots,
  startOfWeekUtc,
  suggestFocusTime,
} from '@/lib/calendar-math';
import { eventsForDay, WORKDAY } from '@/mock/calendar';
import { API_STATUS } from '@/types/api';
import type { CalendarEvent, FreeSlot, Schedule } from '@/types/calendar';
import { mockError, mockRespond } from '../http/mock-transport';
import type { CalendarService, ScheduleQuery } from './types';

/**
 * Mock calendar.
 *
 * Base events come from the deterministic weekday templates; focus blocks the
 * user holds are layered on top and persist for the session, exactly as a real
 * event write would. All intelligence — conflicts, free slots, suggestions — is
 * computed by the pure functions in calendar-math, so the logic under test is
 * the logic that ships.
 */

const MIN_SLOT_MINUTES = 30;

export class MockCalendarService implements CalendarService {
  /** Focus blocks held this session, keyed by day. */
  private readonly heldFocus = new Map<string, CalendarEvent[]>();

  async getSchedule(query: ScheduleQuery): Promise<Schedule> {
    const days =
      query.view === 'week'
        ? Array.from({ length: 7 }, (_, index) =>
            addDaysUtc(startOfWeekUtc(query.date), index),
          )
        : [query.date];

    const events = days
      .flatMap((day) => this.eventsOn(day))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    // Suggestions anchor to the requested day: "where could focus go *today*"
    // is a daily question even when the grid shows the week.
    const anchorDayEvents = this.eventsOn(query.date);
    const freeSlots = findFreeSlots(anchorDayEvents, query.date, WORKDAY, MIN_SLOT_MINUTES);

    const schedule: Schedule = {
      events,
      conflicts: findConflicts(events),
      freeSlots,
      // An empty day needs no focus suggestion — there is nothing to defend
      // the time against, and suggesting work on a weekend is noise.
      focusSuggestions: anchorDayEvents.length === 0 ? [] : suggestFocusTime(freeSlots),
    };

    const { data } = await mockRespond(schedule);
    return data;
  }

  async holdFocusTime(slot: FreeSlot): Promise<CalendarEvent> {
    const day = slot.startsAt.slice(0, 10);

    // Re-check freshness against current commitments: the slot may have been
    // taken since it was suggested. A real backend must do exactly this.
    const currentSlots = findFreeSlots(this.eventsOn(day), day, WORKDAY, 1);
    const stillFree = currentSlots.some(
      (free) =>
        Date.parse(free.startsAt) <= Date.parse(slot.startsAt) &&
        Date.parse(free.endsAt) >= Date.parse(slot.endsAt),
    );
    if (!stillFree) {
      mockError(
        API_STATUS.Conflict,
        'slot_taken',
        'That time is no longer free.',
        'Something was scheduled into this slot after it was suggested.',
        'Refresh the schedule for a current suggestion.',
      );
    }

    const held: CalendarEvent = {
      id: `evt_${day}_focus_${slot.startsAt.slice(11, 16).replace(':', '')}`,
      title: 'Focus time — held by Kloyya',
      kind: 'focus',
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    };

    this.heldFocus.set(day, [...(this.heldFocus.get(day) ?? []), held]);

    const { data } = await mockRespond(held);
    return data;
  }

  private eventsOn(day: string): CalendarEvent[] {
    return [...eventsForDay(day), ...(this.heldFocus.get(day) ?? [])];
  }
}
