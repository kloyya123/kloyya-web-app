import type { SearchResult } from '@/types/search';

/**
 * The search contract.
 *
 * A real backend runs this against an index (KAS search, or a vector store) and
 * returns ranked hits. The mock ranks the in-memory index with the same pure
 * scorer the UI would trust either way; only the transport changes. Results are
 * capped server-side — the caller asks for a query, not a page.
 */
export interface SearchService {
  search(query: string, limit?: number): Promise<SearchResult[]>;
}
