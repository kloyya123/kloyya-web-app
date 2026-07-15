import { beforeEach, describe, expect, it } from 'vitest';
import { isAllowedOnChannel } from '@/lib/decision-score';
import { configureMockTransport } from '../http/mock-transport';
import { MockIntelligenceService } from './mock-intelligence-service';

describe('MockIntelligenceService', () => {
  const service = new MockIntelligenceService();

  beforeEach(() => {
    configureMockTransport({ instant: true, failureRate: 0 });
  });

  describe('listRecommendations', () => {
    it('ranks by decision score, highest first', async () => {
      const recs = await service.listRecommendations();
      const scores = recs.map((r) => r.decisionScore);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
    });

    it('only returns items the recommendation-feed channel permits', async () => {
      const recs = await service.listRecommendations();
      expect(recs.length).toBeGreaterThan(0);
      expect(recs.every((r) => isAllowedOnChannel(r.priority, 'recommendation_feed'))).toBe(true);
    });

    it('is wider than the dashboard — it carries a Medium item the dashboard hides', async () => {
      const feed = await service.listRecommendations();
      const { recommendations: dashboard } = await service.getDashboard();

      const onlyInFeed = feed.filter(
        (rec) => !dashboard.some((d) => d.id === rec.id),
      );
      expect(onlyInFeed.length).toBeGreaterThan(0);
      expect(onlyInFeed.every((r) => r.priority === 'Medium')).toBe(true);
    });
  });

  describe('recordOutcome', () => {
    it('persists the outcome so a later read reflects it', async () => {
      const [first] = await service.listRecommendations();
      await service.recordOutcome(first!.id, 'accepted');

      const again = await service.listRecommendations();
      expect(again.find((r) => r.id === first!.id)?.outcome).toBe('accepted');

      // Restore so other tests see a clean slate.
      await service.recordOutcome(first!.id, 'pending');
    });
  });
});
