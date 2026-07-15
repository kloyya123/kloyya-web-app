import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '@/types/calendar';
import {
  assignLanes,
  findConflicts,
  findFreeSlots,
  startOfWeekUtc,
  suggestFocusTime,
} from './calendar-math';

/** Build an event on 2026-07-13 (a Monday) between two "HH:MM" UTC times. */
function event(
  id: string,
  start: string,
  end: string,
  kind: CalendarEvent['kind'] = 'meeting',
): CalendarEvent {
  return {
    id,
    title: id,
    kind,
    startsAt: `2026-07-13T${start}:00.000Z`,
    endsAt: `2026-07-13T${end}:00.000Z`,
  };
}

describe('findConflicts', () => {
  it('detects two overlapping meetings with the overlap in minutes', () => {
    const conflicts = findConflicts([
      event('a', '14:00', '15:00'),
      event('b', '14:30', '15:30'),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.eventIds).toEqual(['a', 'b']);
    expect(conflicts[0]?.overlapMinutes).toBe(30);
  });

  it('treats back-to-back meetings as NOT conflicting', () => {
    // 10:00–11:00 then 11:00–12:00 is a tight day, not a double-booking.
    expect(
      findConflicts([event('a', '10:00', '11:00'), event('b', '11:00', '12:00')]),
    ).toHaveLength(0);
  });

  it('only flags meeting-vs-meeting, not focus blocks', () => {
    // A meeting placed over held focus time is a different problem (intrusion),
    // and the spec's "Meeting Conflicts" means double-booked meetings.
    expect(
      findConflicts([event('a', '09:00', '10:00'), event('b', '09:30', '10:30', 'focus')]),
    ).toHaveLength(0);
  });

  it('reports every overlapping pair in a pile-up, ordered by start', () => {
    const conflicts = findConflicts([
      event('a', '13:00', '14:00'),
      event('b', '13:30', '14:30'),
      event('c', '13:45', '14:15'),
    ]);
    expect(conflicts.map((conflict) => conflict.eventIds)).toEqual([
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'c'],
    ]);
  });

  it('handles an empty day', () => {
    expect(findConflicts([])).toEqual([]);
  });
});

describe('findFreeSlots', () => {
  const workday = { dayStartHour: 8, dayEndHour: 18 };

  it('returns the whole workday when nothing is scheduled', () => {
    const slots = findFreeSlots([], '2026-07-13', workday, 30);
    expect(slots).toHaveLength(1);
    expect(slots[0]?.startsAt).toBe('2026-07-13T08:00:00.000Z');
    expect(slots[0]?.endsAt).toBe('2026-07-13T18:00:00.000Z');
    expect(slots[0]?.minutes).toBe(600);
  });

  it('returns the gaps around meetings, merging overlapping busy time', () => {
    const slots = findFreeSlots(
      [
        event('a', '09:00', '10:00'),
        // Overlapping pair merges into one 14:00–15:30 busy block.
        event('b', '14:00', '15:00'),
        event('c', '14:30', '15:30'),
      ],
      '2026-07-13',
      workday,
      30,
    );

    expect(slots.map((slot) => [slot.startsAt, slot.endsAt])).toEqual([
      ['2026-07-13T08:00:00.000Z', '2026-07-13T09:00:00.000Z'],
      ['2026-07-13T10:00:00.000Z', '2026-07-13T14:00:00.000Z'],
      ['2026-07-13T15:30:00.000Z', '2026-07-13T18:00:00.000Z'],
    ]);
  });

  it('drops gaps shorter than the minimum', () => {
    const slots = findFreeSlots(
      [event('a', '08:00', '11:40'), event('b', '12:00', '18:00')],
      '2026-07-13',
      workday,
      30,
    );
    // The 11:40–12:00 gap is 20 minutes: too short to suggest.
    expect(slots).toHaveLength(0);
  });

  it('counts held focus time as busy — a suggestion must not double-book it', () => {
    const slots = findFreeSlots(
      [event('focus', '08:00', '12:00', 'focus'), event('a', '13:00', '18:00')],
      '2026-07-13',
      workday,
      30,
    );
    expect(slots).toHaveLength(1);
    expect(slots[0]?.startsAt).toBe('2026-07-13T12:00:00.000Z');
  });

  it('clamps events that spill outside the workday window', () => {
    const slots = findFreeSlots(
      [event('early', '06:00', '09:00'), event('late', '17:00', '20:00')],
      '2026-07-13',
      workday,
      30,
    );
    expect(slots.map((slot) => [slot.startsAt, slot.endsAt])).toEqual([
      ['2026-07-13T09:00:00.000Z', '2026-07-13T17:00:00.000Z'],
    ]);
  });
});

describe('suggestFocusTime', () => {
  it('returns nothing when there are no usable slots', () => {
    expect(suggestFocusTime([])).toEqual([]);
  });

  it('suggests the longest slot first and explains itself', () => {
    const suggestions = suggestFocusTime([
      { startsAt: '2026-07-13T08:00:00.000Z', endsAt: '2026-07-13T09:00:00.000Z', minutes: 60 },
      { startsAt: '2026-07-13T15:00:00.000Z', endsAt: '2026-07-13T17:30:00.000Z', minutes: 150 },
    ]);

    // The 150-minute slot wins the ordering (its held block is capped at 120).
    expect(suggestions[0]?.slot.startsAt).toBe('2026-07-13T15:00:00.000Z');
    expect(suggestions[0]?.slot.minutes).toBe(120);
    // The Golden Rules: never a bare suggestion. Reason and confidence required.
    for (const suggestion of suggestions) {
      expect(suggestion.reason.length).toBeGreaterThan(0);
      expect(suggestion.confidence).toBeGreaterThan(0);
      expect(suggestion.confidence).toBeLessThanOrEqual(95);
    }
  });

  it('caps focus holds at two hours — longer blocks stop being deep work', () => {
    const suggestions = suggestFocusTime([
      { startsAt: '2026-07-13T08:00:00.000Z', endsAt: '2026-07-13T18:00:00.000Z', minutes: 600 },
    ]);
    expect(suggestions[0]?.slot.minutes).toBeLessThanOrEqual(120);
  });

  it('gives a longer slot more confidence than a shorter one', () => {
    const suggestions = suggestFocusTime([
      { startsAt: '2026-07-13T08:00:00.000Z', endsAt: '2026-07-13T10:00:00.000Z', minutes: 120 },
      { startsAt: '2026-07-13T15:00:00.000Z', endsAt: '2026-07-13T15:45:00.000Z', minutes: 45 },
    ]);
    const [longer, shorter] = suggestions;
    expect(longer!.confidence).toBeGreaterThan(shorter!.confidence);
  });
});

describe('assignLanes', () => {
  it('gives non-overlapping events a single lane', () => {
    const lanes = assignLanes([event('a', '09:00', '10:00'), event('b', '10:00', '11:00')]);
    expect(lanes.get('a')).toEqual({ lane: 0, laneCount: 1 });
    expect(lanes.get('b')).toEqual({ lane: 0, laneCount: 1 });
  });

  it('splits overlapping events into side-by-side lanes', () => {
    const lanes = assignLanes([event('a', '14:00', '15:00'), event('b', '14:30', '15:30')]);
    expect(lanes.get('a')?.lane).toBe(0);
    expect(lanes.get('b')?.lane).toBe(1);
    // Both know the cluster is two wide, so each renders at half width.
    expect(lanes.get('a')?.laneCount).toBe(2);
    expect(lanes.get('b')?.laneCount).toBe(2);
  });

  it('reuses a lane once its previous occupant has ended', () => {
    const lanes = assignLanes([
      event('a', '09:00', '12:00'),
      event('b', '09:30', '10:00'),
      event('c', '10:30', '11:00'),
    ]);
    // b ends before c starts, so c fits back into b's lane.
    expect(lanes.get('b')?.lane).toBe(1);
    expect(lanes.get('c')?.lane).toBe(1);
  });
});

describe('startOfWeekUtc', () => {
  it('returns Monday for any day of the week', () => {
    expect(startOfWeekUtc('2026-07-13')).toBe('2026-07-13'); // Monday
    expect(startOfWeekUtc('2026-07-15')).toBe('2026-07-13'); // Wednesday
    expect(startOfWeekUtc('2026-07-19')).toBe('2026-07-13'); // Sunday
  });
});
