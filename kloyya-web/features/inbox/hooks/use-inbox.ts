'use client';

import { useQuery } from '@tanstack/react-query';
import { services } from '@/services';
import { isApiError } from '@/services/http/errors';

export function useInbox() {
  return useQuery({
    queryKey: ['inbox', 'list'],
    queryFn: () => services.inbox.listInbox(),
  });
}

export function useEmail(id: string) {
  return useQuery({
    queryKey: ['inbox', 'detail', id],
    queryFn: () => services.inbox.getEmail(id),
    // A 404 is an answer, not a transient failure — retrying only delays the
    // "this email no longer exists" screen.
    retry: (failureCount, error) =>
      !(isApiError(error) && !error.isRetryable) && failureCount < 2,
  });
}

/**
 * Per-thread insights. A 404 is expected for routine mail, so the query treats
 * "absent" as data (`null`) rather than an error — the detail page renders fine
 * without suggested replies or extracted tasks.
 */
export function useEmailInsights(emailId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['inbox', 'insights', emailId],
    queryFn: async () => {
      try {
        return await services.inbox.getInsights(emailId);
      } catch (error) {
        if (isApiError(error) && error.httpStatus === 404) return null;
        throw error;
      }
    },
    enabled,
  });
}
