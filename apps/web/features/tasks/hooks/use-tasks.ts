'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { services } from '@/services';
import type { TaskFilters } from '@/services/tasks/types';
import type { TaskStatus } from '@/types/domain';
import { serializeTaskQuery } from '../task-query';

/**
 * The filters *are* the query key.
 *
 * Because filters live in the URL, navigating back re-runs the exact query that
 * produced the previous view — and TanStack serves it from cache instantly.
 * Keeping filter state in a component would have made Back a fresh fetch.
 */
export function useTasks(filters: TaskFilters) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => services.tasks.list({ ...filters, pageSize: 20 }),
    // A page of results stays valid while the user reads it.
    staleTime: 30_000,
  });
}

/**
 * Navigate to a new filter set by writing the URL.
 *
 * `replace` rather than `push`: toggling four filter chips should not leave four
 * entries in the browser history for the user to back through.
 */
export function useTaskFilterNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (filters: TaskFilters, options: { resetCursor?: boolean } = {}) => {
      const search = serializeTaskQuery(filters, options).toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [router, pathname],
  );
}

/**
 * Change a task's status.
 *
 * Not optimistic. A status change can move a row out of the current filter — a
 * task marked done vanishes from a `?status=todo` view — and an optimistic
 * removal that then fails would make a row flicker back into existence. The
 * mock latency here is a few hundred milliseconds; a spinner on the control is
 * more honest than a lie that has to be retracted.
 */
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      services.tasks.updateStatus(id, status),
    onSuccess: () => {
      // Every task query, regardless of filters, may now be stale.
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      // A completed task changes the dashboard's open-task count too.
      void queryClient.invalidateQueries({ queryKey: ['intelligence'] });
    },
  });
}
