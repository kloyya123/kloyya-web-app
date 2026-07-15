import { beforeEach, describe, expect, it } from 'vitest';
import { isApiError } from '../http/errors';
import { configureMockTransport } from '../http/mock-transport';
import { MockKnowledgeService } from './mock-knowledge-service';

describe('MockKnowledgeService', () => {
  const service = new MockKnowledgeService();

  beforeEach(() => {
    configureMockTransport({ instant: true, failureRate: 0 });
  });

  describe('listArticles', () => {
    it('returns every article and the full category set with no filter', async () => {
      const { articles, categories, totalCount } = await service.listArticles();
      expect(articles.length).toBeGreaterThan(0);
      expect(totalCount).toBe(articles.length);
      expect(categories).toEqual([...categories].sort());
      expect(categories).toContain('Decisions');
    });

    it('filters by category', async () => {
      const { articles } = await service.listArticles({ category: 'Decisions' });
      expect(articles.length).toBeGreaterThan(0);
      expect(articles.every((a) => a.category === 'Decisions')).toBe(true);
    });

    it('filters by tag', async () => {
      const { articles } = await service.listArticles({ tag: 'atlas' });
      expect(articles.length).toBeGreaterThan(0);
      expect(articles.every((a) => a.tags.includes('atlas'))).toBe(true);
    });

    it('offers the categories regardless of the active filter', async () => {
      const unfiltered = await service.listArticles();
      const filtered = await service.listArticles({ category: 'Decisions' });
      // The filter control must not collapse to just the category you picked.
      expect(filtered.categories).toEqual(unfiltered.categories);
    });
  });

  describe('getArticle', () => {
    it('merges the body and related nodes onto the summary', async () => {
      const article = await service.getArticle('art_atlas_rescope');
      expect(article.body.length).toBeGreaterThan(0);
      expect(article.relatedNodeIds.length).toBeGreaterThan(0);
      expect(article.title).toContain('Atlas');
    });

    it('throws a non-retryable 404 for an unknown id', async () => {
      await expect(service.getArticle('art_nope')).rejects.toSatisfy(
        (error: unknown) => isApiError(error) && error.httpStatus === 404 && !error.isRetryable,
      );
    });
  });

  describe('getGraph', () => {
    it('returns a coherent graph — every edge endpoint resolves to a node', async () => {
      const { nodes, edges } = await service.getGraph();
      const ids = new Set(nodes.map((n) => n.id));
      for (const edge of edges) {
        expect(ids.has(edge.source)).toBe(true);
        expect(ids.has(edge.target)).toBe(true);
      }
    });

    it('every decision node links to an article that actually exists', async () => {
      const { nodes } = await service.getGraph();
      const decisions = nodes.filter((n) => n.kind === 'decision');
      expect(decisions.length).toBeGreaterThan(0);
      for (const node of decisions) {
        expect(node.entityHref).toMatch(/^\/knowledge\//);
        const id = node.entityHref!.split('/').pop()!;
        await expect(service.getArticle(id)).resolves.toBeTruthy();
      }
    });
  });
});
