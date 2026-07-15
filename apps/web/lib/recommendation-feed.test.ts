import { describe, expect, it } from 'vitest';
import type { Recommendation } from '@/types/domain';
import { partitionFeed } from './recommendation-feed';

function rec(overrides: Partial<Recommendation> & { id: string }): Recommendation {
  return {
    organizationId: 'org',
    workspaceId: 'ws',
    createdBy: 'u',
    updatedBy: 'u',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    version: 1,
    title: 'Rec',
    reason: 'because',
    confidence: 80,
    decisionScore: 80,
    priority: 'High',
    risk: 'Medium',
    evidence: [
      {
        id: 'e',
        sourceType: 'email',
        sourceLabel: 'Gmail',
        excerpt: 'x',
        timestamp: '2026-07-01T00:00:00.000Z',
        reliability: 90,
        freshness: 90,
        ownerId: 'u',
        classification: 'internal',
      },
    ],
    reasoning: [{ id: 's', statement: 'stmt', evidenceIds: [] }],
    assumptions: [],
    conflicts: [],
    suggestedAction: { label: 'Do', isDestructive: false },
    expectedOutcome: 'good',
    whatHappensIfIgnored: 'bad',
    confirmationRequired: false,
    generatedByAgent: 'risk',
    deliveryChannels: ['recommendation_feed'],
    outcome: 'pending',
    ...overrides,
  };
}

describe('partitionFeed', () => {
  it('splits pending from decided', () => {
    const recs = [
      rec({ id: 'a', outcome: 'pending' }),
      rec({ id: 'b', outcome: 'accepted' }),
      rec({ id: 'c', outcome: 'dismissed' }),
    ];
    const { active, decided } = partitionFeed(recs);
    expect(active.map((r) => r.id)).toEqual(['a']);
    expect(decided.map((r) => r.id).sort()).toEqual(['b', 'c']);
  });

  it('ranks active by decision score, highest first', () => {
    const recs = [
      rec({ id: 'low', decisionScore: 60 }),
      rec({ id: 'high', decisionScore: 96 }),
      rec({ id: 'mid', decisionScore: 80 }),
    ];
    const { active } = partitionFeed(recs);
    expect(active.map((r) => r.id)).toEqual(['high', 'mid', 'low']);
  });

  it('ranks decided by most-recently-decided first', () => {
    const recs = [
      rec({ id: 'older', outcome: 'accepted', updatedAt: '2026-07-02T00:00:00.000Z' }),
      rec({ id: 'newer', outcome: 'dismissed', updatedAt: '2026-07-09T00:00:00.000Z' }),
    ];
    const { decided } = partitionFeed(recs);
    expect(decided.map((r) => r.id)).toEqual(['newer', 'older']);
  });

  it('filters by priority across both buckets when asked', () => {
    const recs = [
      rec({ id: 'crit', priority: 'Critical', outcome: 'pending' }),
      rec({ id: 'high', priority: 'High', outcome: 'pending' }),
      rec({ id: 'hiDecided', priority: 'High', outcome: 'accepted' }),
    ];
    const { active, decided } = partitionFeed(recs, 'Critical');
    expect(active.map((r) => r.id)).toEqual(['crit']);
    expect(decided).toHaveLength(0);
  });

  it("'all' keeps every priority", () => {
    const recs = [rec({ id: 'a', priority: 'Critical' }), rec({ id: 'b', priority: 'Medium' })];
    const { active } = partitionFeed(recs, 'all');
    expect(active).toHaveLength(2);
  });

  it('does not mutate its input', () => {
    const recs = [rec({ id: 'a', decisionScore: 10 }), rec({ id: 'b', decisionScore: 90 })];
    const before = recs.map((r) => r.id);
    partitionFeed(recs);
    expect(recs.map((r) => r.id)).toEqual(before);
  });
});
