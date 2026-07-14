import type { PriorityLevel, Recommendation } from '@/types/domain';
import { byDecisionScoreDesc } from './decision-score';

/**
 * Recommendation-feed policy — the one place the feed decides shape and order.
 *
 * The feed splits into two, deliberately, rather than sorting one list: what
 * still needs a decision, and what you've already decided. Active items rank by
 * decision score (KDSE ranks by score, not recency); decided items rank by when
 * you decided, most recent first, so the last thing you actioned stays findable.
 *
 * Pure and out of the service so the rule is unit-testable and a priority filter
 * can run client-side without a refetch — the same discipline as inbox-priority.
 */

export type PriorityFilter = PriorityLevel | 'all';

export interface RecommendationFeed {
  /** Undecided, highest decision score first. */
  active: Recommendation[];
  /** Decided, most recently decided first. */
  decided: Recommendation[];
}

export function partitionFeed(
  recommendations: readonly Recommendation[],
  priority: PriorityFilter = 'all',
): RecommendationFeed {
  const matches = recommendations.filter(
    (rec) => priority === 'all' || rec.priority === priority,
  );

  const active = matches
    .filter((rec) => rec.outcome === 'pending')
    .sort(byDecisionScoreDesc);

  const decided = matches
    .filter((rec) => rec.outcome !== 'pending')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return { active, decided };
}
