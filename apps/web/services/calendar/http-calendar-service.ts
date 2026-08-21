import type { CalendarEvent, FreeSlot, Schedule } from '@/types/calendar';
import { apiFetch } from '../http/transport';
import type { CalendarService, ScheduleQuery } from './types';

/** The real CalendarService — maps one-to-one onto /v1/calendar/*. */
export class HttpCalendarService implements CalendarService {
  async getSchedule(query: ScheduleQuery): Promise<Schedule> {
    const params = new URLSearchParams({ date: query.date, view: query.view });
    return apiFetch<Schedule>(`/v1/calendar?${params.toString()}`);
  }

  async holdFocusTime(slot: FreeSlot): Promise<CalendarEvent> {
    return apiFetch<CalendarEvent>('/v1/calendar/focus-time', { method: 'POST', body: slot });
  }
}
