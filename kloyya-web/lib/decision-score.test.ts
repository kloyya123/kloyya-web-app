import { describe, expect, it } from 'vitest';
import type { PriorityLevel } from '@/types/domain';
import {
  byDecisionScoreDesc,
  clampScore,
  isAllowedOnChannel,
  priorityFromDecisionScore,
} from './decision-score';

describe('clampScore', () => {
  it('clamps into 0-100', () => {
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(150)).toBe(100);
    expect(clampScore(42)).toBe(42);
  });

  it('treats NaN as zero rather than propagating it', () => {
    // A NaN score would silently poison every comparison downstream.
    expect(clampScore(Number.NaN)).toBe(0);
  });
});

describe('priorityFromDecisionScore', () => {
  // KDSE bands, tested at both edges. Off-by-one here decides whether an item
  // is allowed to interrupt the user.
  it.each<[number, PriorityLevel]>([
    [100, 'Critical'],
    [90, 'Critical'],
    [89, 'High'],
    [75, 'High'],
    [74, 'Medium'],
    [50, 'Medium'],
    [49, 'Low'],
    [25, 'Low'],
    [24, 'Background'],
    [0, 'Background'],
  ])('maps %i to %s', (score, expected) => {
    expect(priorityFromDecisionScore(score)).toBe(expected);
  });

  it('clamps out-of-range scores before banding', () => {
    expect(priorityFromDecisionScore(1000)).toBe('Critical');
    expect(priorityFromDecisionScore(-1)).toBe('Background');
  });
});

describe('isAllowedOnChannel', () => {
  it('lets only Critical interrupt with a push notification', () => {
    expect(isAllowedOnChannel('Critical', 'push_notification')).toBe(true);
    for (const p of ['High', 'Medium', 'Low', 'Background'] as const) {
      expect(isAllowedOnChannel(p, 'push_notification')).toBe(false);
    }
  });

  it('admits Critical and High to the dashboard and morning briefing', () => {
    for (const channel of ['dashboard', 'morning_briefing'] as const) {
      expect(isAllowedOnChannel('Critical', channel)).toBe(true);
      expect(isAllowedOnChannel('High', channel)).toBe(true);
      expect(isAllowedOnChannel('Medium', channel)).toBe(false);
    }
  });

  it('never surfaces Background proactively', () => {
    // KDSE: "0-24 Background - indexed only, no proactive surface."
    for (const channel of [
      'push_notification',
      'dashboard',
      'morning_briefing',
      'executive_brief',
      'email',
      'recommendation_feed',
      'search',
      'knowledge',
    ] as const) {
      expect(isAllowedOnChannel('Background', channel)).toBe(false);
    }
    expect(isAllowedOnChannel('Background', 'background_index')).toBe(true);
  });

  it('shows Medium in the recommendation feed without interrupting', () => {
    expect(isAllowedOnChannel('Medium', 'recommendation_feed')).toBe(true);
    expect(isAllowedOnChannel('Medium', 'push_notification')).toBe(false);
  });

  it('shows Low only where relevance is user-initiated', () => {
    // "25-49 Low - stored for reference, shown when relevant."
    expect(isAllowedOnChannel('Low', 'search')).toBe(true);
    expect(isAllowedOnChannel('Low', 'knowledge')).toBe(true);
    expect(isAllowedOnChannel('Low', 'recommendation_feed')).toBe(false);
    expect(isAllowedOnChannel('Low', 'dashboard')).toBe(false);
  });
});

describe('byDecisionScoreDesc', () => {
  it('sorts highest score first', () => {
    const items = [{ decisionScore: 30 }, { decisionScore: 95 }, { decisionScore: 60 }];
    expect([...items].sort(byDecisionScoreDesc).map((i) => i.decisionScore)).toEqual([
      95, 60, 30,
    ]);
  });
});
