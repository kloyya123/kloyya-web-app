'use client';

import { useQuery } from '@tanstack/react-query';
import { services } from '@/services';
import { isApiError } from '@/services/http/errors';

export function useMeetings() {
  return useQuery({
    queryKey: ['meetings', 'list'],
    queryFn: () => services.meetings.listMeetings(),
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: ['meetings', 'detail', id],
    queryFn: () => services.meetings.getMeeting(id),
    // A 404 is an answer, not a transient failure. Retrying it just delays
    // the "this meeting no longer exists" screen.
    retry: (failureCount, error) =>
      !(isApiError(error) && !error.isRetryable) && failureCount < 2,
  });
}

/**
 * The pre-meeting briefing. 404 is expected for past or routine meetings, so
 * the query treats "absent" as data (`null`) rather than as an error state —
 * the detail page renders fine without one.
 */
export function useBriefing(meetingId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['meetings', 'briefing', meetingId],
    queryFn: async () => {
      try {
        return await services.meetings.getBriefing(meetingId);
      } catch (error) {
        if (isApiError(error) && error.httpStatus === 404) return null;
        throw error;
      }
    },
    enabled,
  });
}
