'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { services } from '@/services';

/**
 * Cross-entity search. Shared (top-level hooks/) because both the Search page and
 * the app-shell command palette use it, and the shell may not import a feature.
 *
 * Keyed on the query so results cache per term; `keepPreviousData` holds the last
 * results while the next resolves, so typing never flashes an empty list.
 * Disabled for a blank query, so an empty box makes no request.
 */
export function useSearch(query: string, limit?: number) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['search', trimmed, limit ?? null],
    queryFn: () => services.search.search(trimmed, limit),
    enabled: trimmed.length > 0,
    placeholderData: keepPreviousData,
  });
}
