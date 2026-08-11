import type { Meeting, MeetingBriefing } from '@/types/domain';

export interface MeetingList {
  /** Soonest first. */
  upcoming: Meeting[];
  /** Most recent first. */
  past: Meeting[];
}

/**
 * The meetings contract.
 *
 * A real backend feeds this from the calendar connector (Google Calendar via
 * the Connection Manager): events sync in, the meeting-intelligence agent
 * attaches agendas, briefings, and — after the fact — summaries, action items,
 * and decisions. The shape here is that end state; only the transport
 * changes.
 */
export interface MeetingService {
  listMeetings(): Promise<MeetingList>;

  /** Throws 404 for an unknown id. */
  getMeeting(id: string): Promise<Meeting>;

  /**
   * The pre-meeting briefing. Throws 404 when none exists — past meetings have
   * summaries instead, and a routine meeting may simply not warrant one.
   */
  getBriefing(meetingId: string): Promise<MeetingBriefing>;
}
