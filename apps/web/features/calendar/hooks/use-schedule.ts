'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { services } from '@/services';
import type { CalendarViewKind, FreeSlot } from '@/types/calendar';

const SCHEDULE_KEY = ['calendar', 'schedule'] as const;

export function useSchedule(date: string, view: CalendarViewKind) {
  return useQuery({
    queryKey: [...SCHEDULE_KEY, view, date],
    queryFn: () => services.calendar.getSchedule({ date, view }),
    // A schedule is stable on the scale of minutes; refetching per navigation
    // click would make prev/next feel sluggish for no freshness gain.
    staleTime: 60_000,
  });
}

/**
 * Hold a suggested slot as focus time.
 *
 * Invalidate rather than optimistically patch: holding time changes the
 * conflicts, free slots, AND suggestions — three derived values the client
 * would have to recompute to patch honestly. The service already knows.
 */
export function useHoldFocusTime() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slot: FreeSlot) => services.calendar.holdFocusTime(slot),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY });
    },
  });
}
