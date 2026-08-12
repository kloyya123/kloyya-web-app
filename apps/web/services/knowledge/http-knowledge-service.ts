import type { ArticleDetail, ArticleFilter, ArticleList, KnowledgeGraph } from '@/types/knowledge';
import { apiFetch } from '../http/transport';
import type { KnowledgeService } from './types';

/** The real KnowledgeService — maps onto /v1/knowledge/*. */
export class HttpKnowledgeService implements KnowledgeService {
  async listArticles(filter?: ArticleFilter): Promise<ArticleList> {
    const params = new URLSearchParams();
    if (filter?.category) params.set('category', filter.category);
    if (filter?.tag) params.set('tag', filter.tag);
    const qs = params.toString();
    return apiFetch<ArticleList>(`/v1/knowledge/articles${qs ? `?${qs}` : ''}`);
  }

  async getArticle(id: string): Promise<ArticleDetail> {
    return apiFetch<ArticleDetail>(`/v1/knowledge/articles/${encodeURIComponent(id)}`);
  }

  async getGraph(): Promise<KnowledgeGraph> {
    return apiFetch<KnowledgeGraph>('/v1/knowledge/graph');
  }
}
