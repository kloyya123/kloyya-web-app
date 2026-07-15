import { beforeEach, describe, expect, it } from 'vitest';
import { API_STATUS } from '@/types/api';
import { ApiError } from '../http/errors';
import { configureMockTransport } from '../http/mock-transport';
import { MockMeetingService } from './mock-meeting-service';

configureMockTransport({ instant: true, failureRate: 0 });

describe('MockMeetingService', () => {
  let meetings: MockMeetingService;

  beforeEach(() => {
    meetings = new MockMeetingService();
  });

  describe('listMeetings', () => {
    it('splits upcoming from past against the narrative clock', async () => {
      const { upcoming, past } = await meetings.listMeetings();

      // The Atlas review sits 3h ahead of the pinned clock — always upcoming,
      // no matter what the real wall clock says.
      expect(upcoming.map((meeting) => meeting.id)).toContain('meet_atlas_review');
      expect(past.map((meeting) => meeting.id)).toContain('meet_acme_qbr');
    });

    it('sorts upcoming soonest-first and past most-recent-first', async () => {
      const { upcoming, past } = await meetings.listMeetings();

      const upcomingStarts = upcoming.map((meeting) => meeting.startsAt);
      expect(upcomingStarts).toEqual([...upcomingStarts].sort());

      const pastStarts = past.map((meeting) => meeting.startsAt);
      expect(pastStarts).toEqual([...pastStarts].sort().reverse());
    });

    it('every past meeting carries a summary; no upcoming meeting does', async () => {
      const { upcoming, past } = await meetings.listMeetings();

      expect(past.every((meeting) => meeting.summary !== null)).toBe(true);
      expect(upcoming.every((meeting) => meeting.summary === null)).toBe(true);
    });
  });

  describe('getMeeting', () => {
    it('returns a meeting by id', async () => {
      const meeting = await meetings.getMeeting('meet_acme_qbr');
      expect(meeting.title).toContain('Acme');
      expect(meeting.decisions.length).toBeGreaterThan(0);
    });

    it('404s an unknown id', async () => {
      try {
        await meetings.getMeeting('meet_nope');
        throw new Error('Expected a 404.');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).httpStatus).toBe(API_STATUS.NotFound);
      }
    });
  });

  describe('getBriefing', () => {
    it('returns the briefing for an upcoming meeting, evidence attached', async () => {
      const briefing = await meetings.getBriefing('meet_atlas_review');

      expect(briefing.headline.length).toBeGreaterThan(0);
      expect(briefing.talkingPoints.length).toBeGreaterThan(0);
      expect(briefing.confidence).toBeGreaterThan(0);
      // NonEmpty by type; assert the runtime agrees.
      expect(briefing.evidence.length).toBeGreaterThan(0);
    });

    it('404s a meeting with no briefing', async () => {
      try {
        await meetings.getBriefing('meet_acme_qbr');
        throw new Error('Expected a 404.');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).httpStatus).toBe(API_STATUS.NotFound);
      }
    });
  });
});
