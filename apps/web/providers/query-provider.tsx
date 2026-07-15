'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiError } from '@/services/http/errors';

/**
 * Server state, per KFA. Projects, tasks, knowledge, recommendations, users,
 * and meetings all flow through TanStack Query rather than component state.
 */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Kloyya's data is organizational, not real-time-critical. A minute of
        // staleness is invisible to the user and removes a class of refetch
        // storms on navigation.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Never retry what a retry cannot fix. KAS defines 4xx as client
          // error; hammering a 403 or a 422 wastes the user's rate-limit budget
          // and delays the error state they need to see.
          if (error instanceof ApiError && !error.isRetryable) return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: {
        // Mutations are never retried automatically. KAS marks only specific
        // operations as idempotent; a blind retry on the rest risks duplicate work.
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // Created in state, not at module scope: a module-level client would be shared
  // across requests on the server and leak one user's cache into another's.
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
