'use client';

import { useQuery } from '@tanstack/react-query';
import { services } from '@/services';
import type { SourceCategory } from '@/types/sources';

/**
 * The connected source network and its health.
 *
 * Shared, and cached long: the source list is organizational and changes on the
 * order of minutes, not seconds. The Trusted Knowledge Search indicator, the
 * connected-source badges, and the Trust Center all read from the same cache
 * entry, so the "12 of 18" they each show can never disagree.
 */
export function useSources(category?: SourceCategory) {
  return useQuery({
    queryKey: ['sources', 'list', category ?? 'all'],
    queryFn: () => services.sources.listSources(category),
    staleTime: 60_000,
  });
}

export function useIntelligenceHealth() {
  return useQuery({
    queryKey: ['sources', 'health'],
    queryFn: () => services.sources.getHealth(),
    staleTime: 60_000,
  });
}

export function useSourceUsage(recommendationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['sources', 'usage', recommendationId],
    queryFn: () => services.sources.getSourceUsage(recommendationId),
    // Only fetched when the user opens the "why these sources?" panel — there is
    // no reason to compute retrieval reasoning for a card nobody expanded.
    enabled,
    staleTime: 60_000,
  });
}

export function useKnowledgeCoverage(recommendationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['sources', 'coverage', recommendationId],
    queryFn: () => services.sources.getCoverage(recommendationId),
    enabled,
    staleTime: 60_000,
  });
}
