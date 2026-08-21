import type { SearchResult } from '@/types/search';
import { apiFetch } from '../http/transport';
import type { SearchService } from './types';

/** The real SearchService — maps onto /v1/search. */
export class HttpSearchService implements SearchService {
  async search(query: string, limit?: number): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query });
    if (limit) params.set('limit', String(limit));
    return apiFetch<SearchResult[]>(`/v1/search?${params.toString()}`);
  }
}
