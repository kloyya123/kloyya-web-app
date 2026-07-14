import { mockArticleBodies, mockKnowledgeGraph } from '@/mock/knowledge';
import { mockKnowledgeArticles } from '@/mock/organization';
import { API_STATUS } from '@/types/api';
import type {
  ArticleDetail,
  ArticleFilter,
  ArticleList,
  KnowledgeGraph,
} from '@/types/knowledge';
import { mockError, mockRespond } from '../http/mock-transport';
import type { KnowledgeService } from './types';

/**
 * Mock knowledge base and graph.
 *
 * The article list carries summaries; getArticle merges the body on read, the
 * same absent-until-opened split as briefings. The graph is returned whole and
 * laid out on the client — the service ships relationships, never coordinates.
 */
export class MockKnowledgeService implements KnowledgeService {
  async listArticles(filter: ArticleFilter = {}): Promise<ArticleList> {
    const articles = mockKnowledgeArticles.filter((article) => {
      if (filter.category && article.category !== filter.category) return false;
      if (filter.tag && !article.tags.includes(filter.tag)) return false;
      return true;
    });

    // Categories come from the whole set, not the filtered view — the filter
    // control must not erase the option you just picked away from.
    const categories = [...new Set(mockKnowledgeArticles.map((a) => a.category))].sort();

    const { data } = await mockRespond<ArticleList>({
      articles,
      categories,
      totalCount: articles.length,
    });
    return data;
  }

  async getArticle(id: string): Promise<ArticleDetail> {
    const summary = mockKnowledgeArticles.find((article) => article.id === id);
    const detail = mockArticleBodies[id];
    if (!summary || !detail) {
      mockError(
        API_STATUS.NotFound,
        'article_not_found',
        'That article no longer exists.',
        'It may have been unpublished, or the link may be out of date.',
        'Browse the knowledge base for the current articles.',
      );
    }

    const { data } = await mockRespond<ArticleDetail>({
      ...summary,
      body: detail.body,
      relatedNodeIds: detail.relatedNodeIds,
    });
    return data;
  }

  async getGraph(): Promise<KnowledgeGraph> {
    const { data } = await mockRespond<KnowledgeGraph>(mockKnowledgeGraph);
    return data;
  }
}
