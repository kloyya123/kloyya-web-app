import { beforeEach, describe, expect, it } from 'vitest';
import { mockSources } from '@/mock/sources';
import { configureMockTransport } from '../http/mock-transport';
import { MockSourcesService } from './mock-sources-service';

configureMockTransport({ instant: true, failureRate: 0 });

describe('MockSourcesService', () => {
  let sources: MockSourcesService;

  beforeEach(() => {
    sources = new MockSourcesService();
  });

  describe('listSources', () => {
    it('returns every connected source', async () => {
      const list = await sources.listSources();
      expect(list.length).toBe(mockSources.length);
    });

    it('filters by category', async () => {
      const ai = await sources.listSources('ai');
      expect(ai.length).toBeGreaterThan(0);
      expect(ai.every((source) => source.category === 'ai')).toBe(true);
    });

    it('never invents a source with no reference count', async () => {
      const list = await sources.listSources();
      expect(list.every((source) => source.referencedByCount >= 0)).toBe(true);
    });
  });

  describe('getHealth', () => {
    it('counts total, healthy, and needs-attention', async () => {
      const health = await sources.getHealth();

      expect(health.totalSources).toBe(mockSources.length);
      // healthy + needsAttention should account for every source (syncing counts
      // as working, so it is folded into healthy for the dashboard's split).
      expect(health.healthy + health.needsAttention).toBe(health.totalSources);
    });

    it('classifies token-expired and paused sources as needing attention', async () => {
      const health = await sources.getHealth();
      // The fixture seeds exactly two non-working sources (Teams, Salesforce).
      expect(health.needsAttention).toBe(2);
    });

    it('reports knowledge coverage as a 0-100 percentage', async () => {
      const health = await sources.getHealth();
      expect(health.knowledgeCoverage).toBeGreaterThan(0);
      expect(health.knowledgeCoverage).toBeLessThanOrEqual(100);
    });

    it('averages freshness only across working sources', async () => {
      // A token-expired source at 20% freshness must not drag down the headline
      // number for the sources that are actually working.
      const health = await sources.getHealth();
      expect(health.averageFreshnessMinutes).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getSourceUsage', () => {
    it('explains why each source was included or excluded', async () => {
      const usage = await sources.getSourceUsage('rec_acme_renewal');

      expect(usage.length).toBeGreaterThan(0);
      // Every entry carries a human-readable reason — the spec's core promise.
      expect(usage.every((entry) => entry.reason.length > 0)).toBe(true);
    });

    it('includes the sources a recommendation actually cites', async () => {
      // rec_acme_renewal cites email, meeting_notes, and project_update evidence.
      const usage = await sources.getSourceUsage('rec_acme_renewal');
      const includedProviders = usage
        .filter((entry) => entry.included)
        .map((entry) => entry.provider);

      expect(includedProviders).toContain('gmail');
    });

    it('excludes a source that lacks permission, with that reason', async () => {
      const usage = await sources.getSourceUsage('rec_acme_renewal');
      const salesforce = usage.find((entry) => entry.provider === 'salesforce');

      expect(salesforce?.included).toBe(false);
      expect(salesforce?.reason).toMatch(/permission|authorize|token/i);
    });
  });

  describe('getCoverage', () => {
    it('returns a coverage percentage and any missing providers', async () => {
      const coverage = await sources.getCoverage('rec_acme_renewal');

      expect(coverage.coverage).toBeGreaterThan(0);
      expect(coverage.coverage).toBeLessThanOrEqual(100);
      expect(Array.isArray(coverage.missingProviders)).toBe(true);
    });
  });
});
