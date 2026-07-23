'use client';

import { useQuery } from '@tanstack/react-query';
import { services } from '@/services';

/**
 * The inbox list, shared by every surface that shows it (the sidebar's unread
 * badge, the dashboard's stat tile and Recent Messages card). One cache key, one
 * fetch — a hook so components stay off the service layer directly (KFA).
 */
export function useInboxList() {
  return useQuery({
    queryKey: ['inbox', 'list'],
    queryFn: () => services.inbox.listInbox(),
    staleTime: 30_000,
  });
}
