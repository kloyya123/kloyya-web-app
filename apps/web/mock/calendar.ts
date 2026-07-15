import type { CalendarEvent, EventKind } from '@/types/calendar';

/**
 * Northwind's working week, generated deterministically from the date.
 *
 * Weekday templates rather than a fixed dataset, so the calendar is alive on
 * whatever day it is opened, and tests can pin any date and get the same
 * events. Weekends are honestly empty.
 *
 * Two deliberate features of the data:
 *   - Friday carries the Atlas milestone review (meet_atlas_review), the same
 *     meeting the dashboard's briefing and recommendations revolve around —
 *     one coherent story across every screen.
 *   - Monday afternoon is double-booked (Acme renewal sync vs Q3 budget
 *     review), so conflict detection has something true to find.
 */

interface EventSeed {
  slug: string;
  title: string;
  kind: EventKind;
  /** "HH:MM" UTC. */
  start: string;
  end: string;
  meetingId?: string;
  attendees?: string[];
}

const WEEKDAY_TEMPLATES: Record<number, EventSeed[]> = {
  // Monday
  1: [
    { slug: 'standup', title: 'Leadership standup', kind: 'meeting', start: '09:15', end: '09:30', attendees: ['Amara Osei', 'Daniel Reyes', 'Priya Nair'] },
    { slug: 'daniel-1-1', title: '1:1 — Daniel Reyes', kind: 'meeting', start: '10:00', end: '10:30', attendees: ['Amara Osei', 'Daniel Reyes'] },
    { slug: 'acme-sync', title: 'Acme renewal sync', kind: 'meeting', start: '14:00', end: '15:00', attendees: ['Amara Osei', 'Lena Fischer', 'Marcus Webb'] },
    { slug: 'budget-review', title: 'Q3 budget review', kind: 'meeting', start: '14:30', end: '15:30', attendees: ['Amara Osei', 'Priya Nair'] },
    { slug: 'customer-call', title: 'Customer call — Meridian rollout', kind: 'meeting', start: '16:00', end: '16:30', attendees: ['Amara Osei'] },
  ],
  // Tuesday
  2: [
    { slug: 'standup', title: 'Leadership standup', kind: 'meeting', start: '09:15', end: '09:30', attendees: ['Amara Osei', 'Daniel Reyes', 'Priya Nair'] },
    { slug: 'product-review', title: 'Meridian product review', kind: 'meeting', start: '13:00', end: '14:00', attendees: ['Amara Osei', 'Priya Nair'] },
    { slug: 'priya-1-1', title: '1:1 — Priya Nair', kind: 'meeting', start: '15:00', end: '15:30', attendees: ['Amara Osei', 'Priya Nair'] },
  ],
  // Wednesday
  3: [
    { slug: 'standup', title: 'Leadership standup', kind: 'meeting', start: '09:15', end: '09:30', attendees: ['Amara Osei', 'Daniel Reyes', 'Priya Nair'] },
    { slug: 'legal-sync', title: 'Legal sync — Acme section 8', kind: 'meeting', start: '09:45', end: '10:15', attendees: ['Amara Osei', 'Lena Fischer'] },
    { slug: 'hiring-panel', title: 'Hiring panel — Staff engineer', kind: 'meeting', start: '15:30', end: '16:15', attendees: ['Amara Osei', 'Daniel Reyes'] },
  ],
  // Thursday
  4: [
    { slug: 'standup', title: 'Leadership standup', kind: 'meeting', start: '09:15', end: '09:30', attendees: ['Amara Osei', 'Daniel Reyes', 'Priya Nair'] },
    { slug: 'board-prep', title: 'Board pack preparation', kind: 'meeting', start: '13:00', end: '14:30', attendees: ['Amara Osei'] },
  ],
  // Friday
  5: [
    { slug: 'standup', title: 'Leadership standup', kind: 'meeting', start: '09:15', end: '09:30', attendees: ['Amara Osei', 'Daniel Reyes', 'Priya Nair'] },
    { slug: 'atlas-review', title: 'Atlas milestone review', kind: 'meeting', start: '11:00', end: '12:00', meetingId: 'meet_atlas_review', attendees: ['Amara Osei', 'Daniel Reyes'] },
    { slug: 'retro', title: 'Leadership retro', kind: 'meeting', start: '14:00', end: '14:45', attendees: ['Amara Osei', 'Daniel Reyes', 'Priya Nair'] },
  ],
};

/** The events of one day ("YYYY-MM-DD"). Weekends return []. */
export function eventsForDay(date: string): CalendarEvent[] {
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const template = WEEKDAY_TEMPLATES[weekday] ?? [];

  return template.map((seed) => {
    const event: CalendarEvent = {
      // Stable per date+slug, so a held focus block and a re-fetch agree on ids.
      id: `evt_${date}_${seed.slug}`,
      title: seed.title,
      kind: seed.kind,
      startsAt: `${date}T${seed.start}:00.000Z`,
      endsAt: `${date}T${seed.end}:00.000Z`,
    };
    if (seed.meetingId !== undefined) event.meetingId = seed.meetingId;
    if (seed.attendees !== undefined) event.attendees = seed.attendees;
    return event;
  });
}

/** The workday the mock plans within. UTC, matching every other mock timestamp. */
export const WORKDAY = { dayStartHour: 8, dayEndHour: 18 } as const;
