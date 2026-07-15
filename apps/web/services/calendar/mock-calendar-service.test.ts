import { beforeEach, describe, expect, it } from 'vitest';
import { API_STATUS } from '@/types/api';
import { ApiError } from '../http/errors';
import { configureMockTransport } from '../http/mock-transport';
import { MockCalendarService } from './mock-calendar-service';

configureMockTransport({ instant: true, failureRate: 0 });

// 2026-07-13 is a Monday; 2026-07-17 a Friday; 2026-07-18 a Saturday.
const MONDAY = '2026-07-13';
const FRIDAY = '2026-07-17';
const SATURDAY = '2026-07-18';

describe('MockCalendarService', () => {
  let calendar: MockCalendarService;

  beforeEach(() => {
    calendar = new MockCalendarService();
  });

  describe('getSchedule — day view', () => {
    it('returns the day’s events sorted by start', async () => {
      const schedule = await calendar.getSchedule({ date: MONDAY, view: 'day' });

      expect(schedule.events.length).toBeGreaterThan(0);
      const starts = schedule.events.map((event) => event.startsAt);
      expect(starts).toEqual([...starts].sort());
    });

    it('detects Monday’s double-booking', async () => {
      const schedule = await calendar.getSchedule({ date: MONDAY, view: 'day' });

      expect(schedule.conflicts).toHaveLength(1);
      expect(schedule.conflicts[0]?.eventIds).toEqual([
        `evt_${MONDAY}_acme-sync`,
        `evt_${MONDAY}_budget-review`,
      ]);
      expect(schedule.conflicts[0]?.overlapMinutes).toBe(30);
    });

    it('offers focus suggestions with reasons for the day', async () => {
      const schedule = await calendar.getSchedule({ date: MONDAY, view: 'day' });

      expect(schedule.focusSuggestions.length).toBeGreaterThan(0);
      for (const suggestion of schedule.focusSuggestions) {
        expect(suggestion.reason.length).toBeGreaterThan(0);
        expect(suggestion.confidence).toBeGreaterThan(0);
      }
    });

    it('returns an empty, conflict-free weekend', async () => {
      const schedule = await calendar.getSchedule({ date: SATURDAY, view: 'day' });

      expect(schedule.events).toHaveLength(0);
      expect(schedule.conflicts).toHaveLength(0);
      // A free weekend is not a focus-time opportunity to fill.
      expect(schedule.focusSuggestions).toHaveLength(0);
    });

    it('carries the Atlas review with its meeting linkage on Friday', async () => {
      const schedule = await calendar.getSchedule({ date: FRIDAY, view: 'day' });
      const atlas = schedule.events.find((event) => event.meetingId === 'meet_atlas_review');
      expect(atlas?.title).toBe('Atlas milestone review');
    });
  });

  describe('getSchedule — week view', () => {
    it('returns the whole week’s events for any date inside it', async () => {
      // Wednesday inside the week of MONDAY.
      const schedule = await calendar.getSchedule({ date: '2026-07-15', view: 'week' });

      const days = new Set(schedule.events.map((event) => event.startsAt.slice(0, 10)));
      expect(days).toEqual(new Set(['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17']));
    });

    it('anchors free slots and suggestions to the requested day, not the week', async () => {
      const schedule = await calendar.getSchedule({ date: MONDAY, view: 'week' });
      for (const slot of schedule.freeSlots) {
        expect(slot.startsAt.slice(0, 10)).toBe(MONDAY);
      }
    });
  });

  describe('holdFocusTime', () => {
    it('adds a focus event that persists into the next schedule read', async () => {
      const before = await calendar.getSchedule({ date: MONDAY, view: 'day' });
      const suggestion = before.focusSuggestions[0]!;

      const held = await calendar.holdFocusTime(suggestion.slot);
      expect(held.kind).toBe('focus');

      const after = await calendar.getSchedule({ date: MONDAY, view: 'day' });
      expect(after.events.some((event) => event.id === held.id)).toBe(true);
      // The held time is now busy: no suggestion may propose it again.
      for (const next of after.focusSuggestions) {
        expect(next.slot.startsAt).not.toBe(suggestion.slot.startsAt);
      }
    });

    it('rejects holding time that is already committed', async () => {
      const schedule = await calendar.getSchedule({ date: MONDAY, view: 'day' });
      const suggestion = schedule.focusSuggestions[0]!;
      await calendar.holdFocusTime(suggestion.slot);

      try {
        await calendar.holdFocusTime(suggestion.slot);
        throw new Error('Expected a conflict rejection.');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).httpStatus).toBe(API_STATUS.Conflict);
      }
    });
  });
});
