'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { services } from '@/services';
import type { AppNotification } from '@/types/domain';
import { DASHBOARD_KEY } from './use-intelligence';

/**
 * Notifications. Shared (top-level hooks/) because the bell lives in the app
 * shell, which may not import a feature — the same layering rule the search hook
 * follows.
 *
 * Mutations are optimistic: the badge clears the instant you act, because the
 * user already decided (Principle 14). On settle both this key and the dashboard
 * key are invalidated — they read the same underlying store, so a stale dashboard
 * would show a notification the bell has already cleared.
 */
export const NOTIFICATIONS_KEY = ['notifications', 'list'] as const;

export function useNotifications() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => services.notifications.listNotifications(),
  });
}

function useNotificationMutation<V>(
  mutationFn: (variables: V) => Promise<unknown>,
  apply: (list: AppNotification[], variables: V) => AppNotification[],
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables: V) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const previous = queryClient.getQueryData<AppNotification[]>(NOTIFICATIONS_KEY);
      queryClient.setQueryData<AppNotification[]>(NOTIFICATIONS_KEY, (current) =>
        current ? apply(current, variables) : current,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      // An optimistic update that cannot roll back is a lie.
      if (context?.previous) {
        queryClient.setQueryData(NOTIFICATIONS_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
}

export function useMarkRead() {
  return useNotificationMutation(
    (id: string) => services.notifications.markRead(id),
    (list, id) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
  );
}

export function useMarkAllRead() {
  return useNotificationMutation(
    () => services.notifications.markAllRead(),
    (list) => list.map((n) => (n.isRead ? n : { ...n, isRead: true })),
  );
}
