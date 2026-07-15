'use client';

import { useQuery } from '@tanstack/react-query';
import { services } from '@/services';
import { isApiError } from '@/services/http/errors';
import type { ArticleFilter } from '@/types/knowledge';

export function useArticles(filter: ArticleFilter) {
  return useQuery({
    // The filter is part of the key so switching category refetches and caches.
    queryKey: ['knowledge', 'articles', filter.category ?? null, filter.tag ?? null],
    queryFn: () => services.knowledge.listArticles(filter),
  });
}

export function useArticle(id: string) {
  return useQuery({
    queryKey: ['knowledge', 'article', id],
    queryFn: () => services.knowledge.getArticle(id),
    retry: (failureCount, error) =>
      !(isApiError(error) && !error.isRetryable) && failureCount < 2,
  });
}

export function useKnowledgeGraph() {
  return useQuery({
    queryKey: ['knowledge', 'graph'],
    queryFn: () => services.knowledge.getGraph(),
    // The graph is org-scale and changes slowly; keep it warm across navigation.
    staleTime: 5 * 60 * 1000,
  });
}
