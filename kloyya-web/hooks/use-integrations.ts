'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { services } from '@/services';
import type { IntegrationCategory, IntegrationConnection } from '@/types/integrations';

/**
 * The Connection Manager's server state.
 *
 * The catalogue query and the summary query share a cache: a connect or
 * disconnect invalidates both, so the dashboard widget's "12 of 18" and the
 * manager's cards can never disagree.
 */
const CONNECTIONS_KEY = ['integrations', 'connections'] as const;
const SUMMARY_KEY = ['integrations', 'summary'] as const;

export function useConnections(category?: IntegrationCategory) {
  return useQuery({
    queryKey: [...CONNECTIONS_KEY, category ?? 'all'],
    queryFn: () => services.integrations.listConnections(category),
    staleTime: 60_000,
  });
}

export function useConnectionSummary() {
  return useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: () => services.integrations.getSummary(),
    staleTime: 60_000,
  });
}

/** The lifecycle actions a card can invoke. */
export type ConnectionAction =
  | 'connect'
  | 'disconnect'
  | 'pause'
  | 'resume'
  | 'reconnect'
  | 'forceSync';

const ACTIONS: Record<
  ConnectionAction,
  (id: string) => Promise<IntegrationConnection>
> = {
  connect: (id) => services.integrations.connect(id),
  disconnect: (id) => services.integrations.disconnect(id),
  pause: (id) => services.integrations.pause(id),
  resume: (id) => services.integrations.resume(id),
  reconnect: (id) => services.integrations.reconnect(id),
  forceSync: (id) => services.integrations.forceSync(id),
};

/**
 * One mutation for every lifecycle action.
 *
 * A single hook rather than six keeps the pending/error handling in one place,
 * and lets a card disable all of its buttons while any action is in flight —
 * connecting and disconnecting the same app at once is not a state we want.
 */
export function useConnectionAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ action, id }: { action: ConnectionAction; id: string }) =>
      ACTIONS[action](id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
    },
  });
}
