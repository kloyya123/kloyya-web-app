import { searchDocs } from '@/lib/search';
import { mockSearchIndex } from '@/mock/search-index';
import type { SearchResult } from '@/types/search';
import { mockRespond } from '../http/mock-transport';
import type { SearchService } from './types';

/**
 * Mock search.
 *
 * Ranking is the pure `searchDocs` scorer — the same function the tests trust —
 * run over the in-memory index. A real backend swaps the index and the transport
 * for a search engine; the result shape, and the relevance contract, stay put.
 */
export class MockSearchService implements SearchService {
  async search(query: string, limit?: number): Promise<SearchResult[]> {
    const results = searchDocs(mockSearchIndex, query, limit);
    const { data } = await mockRespond(results);
    return data;
  }
}
