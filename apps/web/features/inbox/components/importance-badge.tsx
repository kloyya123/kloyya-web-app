import { Badge } from '@/components/ui';
import { importanceTier, type ImportanceTier } from '@/lib/inbox-priority';
import type { Score } from '@/types/domain';

/**
 * One place a thread's importance becomes a badge.
 *
 * Both the list and the detail view show it, so the score→tone→label mapping
 * lives here rather than being copied. The label always states the tier in
 * words — meaning never rides on hue alone (WCAG 1.4.1) — and the dot only
 * reinforces the two tiers that warrant a glance.
 */

const TIER_TONE: Record<ImportanceTier, 'danger' | 'warning' | 'neutral'> = {
  critical: 'danger',
  high: 'warning',
  normal: 'neutral',
};

const TIER_LABEL: Record<ImportanceTier, string> = {
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
};

export function ImportanceBadge({
  score,
  suffix = '',
}: {
  score: Score;
  /** e.g. " priority" to read "High priority" on the detail view. */
  suffix?: string;
}) {
  const tier = importanceTier(score);
  return (
    <Badge tone={TIER_TONE[tier]} withDot={tier !== 'normal'}>
      {TIER_LABEL[tier]}
      {suffix}
    </Badge>
  );
}
