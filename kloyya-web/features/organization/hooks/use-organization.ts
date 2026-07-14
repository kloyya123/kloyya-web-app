'use client';

import { useQuery } from '@tanstack/react-query';
import { services } from '@/services';
import { isApiError } from '@/services/http/errors';

export function useOrganization() {
  return useQuery({
    queryKey: ['organization', 'overview'],
    queryFn: () => services.organization.getOverview(),
  });
}

export function useMember(id: string) {
  return useQuery({
    queryKey: ['organization', 'member', id],
    queryFn: () => services.organization.getMember(id),
    retry: (failureCount, error) =>
      !(isApiError(error) && !error.isRetryable) && failureCount < 2,
  });
}
