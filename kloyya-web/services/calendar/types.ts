import type {
  CalendarEvent,
  CalendarViewKind,
  FreeSlot,
  Schedule,
} from '@/types/calendar';

export interface ScheduleQuery {
  /** Anchor day, "YYYY-MM-DD". Week view expands to that day's Mon–Sun. */
  date: string;
  view: CalendarViewKind;
}

/**
 * The calendar contract.
 *
 * A real backend answers `getSchedule` from the synced Google/Microsoft
 * calendars (the connectors the Connection Manager manages) and computes the
 * intelligence — conflicts, free slots, suggestions — server-side with the same
 * pure functions the mock uses today. `holdFocusTime` becomes a real event
 * write, which is why it can fail with a conflict: someone may have booked the
 * slot between the suggestion and the click.
 */
export interface CalendarService {
  getSchedule(query: ScheduleQuery): Promise<Schedule>;

  /** Commit a suggested slot as held focus time. Throws 409 if no longer free. */
  holdFocusTime(slot: FreeSlot): Promise<CalendarEvent>;
}
