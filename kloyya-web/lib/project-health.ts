import type { Project, Score } from '@/types/domain';
import { clampScore } from './decision-score';

/**
 * Project health — banding, ranking, and deadline math in one testable place.
 *
 * The health score arrives from the data (a real backend computes it); this file
 * decides only how it *reads* and how projects *rank*. Worst-first ordering is
 * deliberate: the Manifesto's "know what matters" means the project in trouble
 * belongs at the top, not buried under the healthy ones.
 */

export type HealthBand = 'strong' | 'fair' | 'poor';

export function healthBand(score: number): HealthBand {
  const value = clampScore(score);
  if (value >= 75) return 'strong';
  if (value >= 50) return 'fair';
  return 'poor';
}

/** Comparator: lowest health first, so a project that needs attention leads. */
export function byHealthAsc(a: Project, b: Project): number {
  return a.healthScore - b.healthScore;
}

const DAY_MS = 86_400_000;

/**
 * Whole days from `now` to a deadline — negative once it's passed, null when
 * there is no deadline. Rounded, so "in 3 days" is stable regardless of the hour.
 */
export function daysUntil(deadline: string | undefined, now: Date): number | null {
  if (!deadline) return null;
  const target = Date.parse(deadline);
  if (Number.isNaN(target)) return null;
  return Math.round((target - now.getTime()) / DAY_MS);
}

/** Convenience for callers that only need the banded health of a raw score. */
export function isPoorHealth(score: Score): boolean {
  return healthBand(score) === 'poor';
}
