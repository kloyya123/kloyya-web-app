import type { Meeting, MeetingBriefing } from '@/types/domain';
import { apiFetch } from '../http/transport';
import type { MeetingList, MeetingService } from './types';

/** The real MeetingService — maps one-to-one onto /v1/meetings/*. */
export class HttpMeetingService implements MeetingService {
  async listMeetings(): Promise<MeetingList> {
    return apiFetch<MeetingList>('/v1/meetings');
  }

  async getMeeting(id: string): Promise<Meeting> {
    return apiFetch<Meeting>(`/v1/meetings/${encodeURIComponent(id)}`);
  }

  async getBriefing(meetingId: string): Promise<MeetingBriefing> {
    return apiFetch<MeetingBriefing>(`/v1/meetings/${encodeURIComponent(meetingId)}/briefing`);
  }
}
