import type { DeliveryChannel, PriorityLevel, Score } from '@/types/domain';

/**
 * KDSE Priority Levels — the only numeric bands any Kloyya document specifies.
 *
 *   90–100  Critical    immediate attention; may trigger notifications
 *   75–89   High        Dashboard, Morning Briefing, highlighted in Search
 *   50–74   Medium      visible in recommendations; no interruption
 *   25–49   Low         stored for reference; shown when relevant
 *    0–24   Background  indexed only; never proactively surfaced
 *
 * These bands govern *where an item may appear*, not merely how it looks. That
 * makes this file a policy boundary, not a formatting helper.
 */
const BANDS = [
  { min: 90, level: 'Critical' },
  { min: 75, level: 'High' },
  { min: 50, level: 'Medium' },
  { min: 25, level: 'Low' },
  { min: 0, level: 'Background' },
] as const satisfies ReadonlyArray<{ min: number; level: PriorityLevel }>;

/** Clamp any incoming score into 0–100. A backend regression must not crash the UI. */
export function clampScore(value: number): Score {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * The single place a decision score becomes a priority level.
 *
 * `Recommendation.priority` is never assigned independently — it is derived
 * here, so a recommendation cannot claim Critical priority with a score of 12.
 */
export function priorityFromDecisionScore(decisionScore: number): PriorityLevel {
  const score = clampScore(decisionScore);
  // Bands are ordered high→low, so the first match is the correct one.
  for (const band of BANDS) {
    if (score >= band.min) return band.level;
  }
  return 'Background';
}

/**
 * KDSE: the same recommendation renders differently by channel depending on its
 * score. Encoding the rule here means a widget cannot accidentally surface a
 * Background item on the dashboard.
 */
export function isAllowedOnChannel(
  priority: PriorityLevel,
  channel: DeliveryChannel,
): boolean {
  switch (channel) {
    // "Critical (90–100) may trigger notifications." Nothing else may interrupt.
    case 'push_notification':
      return priority === 'Critical';

    // "High (75–89): Dashboard, Morning Briefing." Critical qualifies a fortiori.
    case 'dashboard':
    case 'morning_briefing':
    case 'executive_brief':
    case 'email':
      return priority === 'Critical' || priority === 'High';

    // "Medium (50–74): visible in recommendations, no interruption."
    case 'recommendation_feed':
      return priority !== 'Background' && priority !== 'Low';

    // "Low (25–49): stored for reference, shown when relevant."
    case 'search':
    case 'knowledge':
      return priority !== 'Background';

    // "Background (0–24): indexed only, no proactive surface."
    case 'background_index':
      return true;
  }
}

/** Ranking comparator. KDSE orders competing items by decision score, descending. */
export function byDecisionScoreDesc<T extends { decisionScore: Score }>(
  a: T,
  b: T,
): number {
  return b.decisionScore - a.decisionScore;
}
