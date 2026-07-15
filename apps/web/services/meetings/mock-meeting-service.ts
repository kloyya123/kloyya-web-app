import { mockBriefings } from '@/mock/briefings';
import { MOCK_NOW, mockMeetings } from '@/mock/organization';
import { API_STATUS } from '@/types/api';
import type { Meeting, MeetingBriefing } from '@/types/domain';
import { mockError, mockRespond } from '../http/mock-transport';
import type { MeetingList, MeetingService } from './types';

/**
 * Mock meetings.
 *
 * Upcoming/past is split against the narrative clock (MOCK_NOW), not the wall
 * clock — the mock story lives on a pinned day, and comparing against real time
 * would quietly age every "upcoming" meeting into the past.
 */
export class MockMeetingService implements MeetingService {
  async listMeetings(): Promise<MeetingList> {
    const now = MOCK_NOW.getTime();

    const upcoming = mockMeetings
      .filter((meeting) => Date.parse(meeting.startsAt) > now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    const past = mockMeetings
      .filter((meeting) => Date.parse(meeting.startsAt) <= now)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

    const { data } = await mockRespond<MeetingList>({ upcoming, past });
    return data;
  }

  async getMeeting(id: string): Promise<Meeting> {
    const meeting = mockMeetings.find((candidate) => candidate.id === id);
    if (!meeting) {
      mockError(
        API_STATUS.NotFound,
        'meeting_not_found',
        'That meeting no longer exists.',
        'It may have been cancelled, or the link may be out of date.',
        'Go back to your meetings list for the current schedule.',
      );
    }

    const { data } = await mockRespond(meeting);
    return data;
  }

  async getBriefing(meetingId: string): Promise<MeetingBriefing> {
    const briefing = mockBriefings[meetingId];
    if (!briefing) {
      mockError(
        API_STATUS.NotFound,
        'briefing_not_available',
        'No briefing exists for this meeting.',
        'Briefings are prepared for upcoming meetings that need one.',
        'Past meetings carry a summary instead.',
      );
    }

    const { data } = await mockRespond(briefing);
    return data;
  }
}
