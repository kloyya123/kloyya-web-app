import type {
  ArticleDetail,
  ArticleFilter,
  ArticleList,
  KnowledgeGraph,
} from '@/types/knowledge';

/**
 * The knowledge contract.
 *
 * A real backend builds this from the ingestion pipeline: connected sources are
 * parsed into entities and relationships (KOMGA/KARE), curated decisions become
 * articles, and the graph is queried on demand. The shape here is that end
 * state; only the transport changes. Layout is deliberately absent — it is a
 * pure client concern (lib/graph-layout), so the server never ships coordinates.
 */
export interface KnowledgeService {
  listArticles(filter?: ArticleFilter): Promise<ArticleList>;

  /** Throws 404 for an unknown id. */
  getArticle(id: string): Promise<ArticleDetail>;

  /** The whole organizational graph. The view chooses what to focus. */
  getGraph(): Promise<KnowledgeGraph>;
}
