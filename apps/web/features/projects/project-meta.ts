import type { BadgeTone } from '@/components/ui';
import { healthBand, type HealthBand } from '@/lib/project-health';
import type { ProjectStatus, Score } from '@/types/domain';

/**
 * How a project's status and health read — labels and tones in one place, so the
 * board and the detail view never disagree on what "at risk" looks like. Meaning
 * is always in the label, never the colour alone (WCAG 1.4.1).
 */

export const STATUS_META: Record<ProjectStatus, { label: string; tone: BadgeTone }> = {
  planning: { label: 'Planning', tone: 'neutral' },
  active: { label: 'Active', tone: 'primary' },
  at_risk: { label: 'At risk', tone: 'danger' },
  paused: { label: 'Paused', tone: 'warning' },
  complete: { label: 'Complete', tone: 'success' },
};

const HEALTH_META: Record<HealthBand, { label: string; tone: BadgeTone }> = {
  strong: { label: 'Healthy', tone: 'success' },
  fair: { label: 'Needs watching', tone: 'warning' },
  poor: { label: 'At risk', tone: 'danger' },
};

export function healthMeta(score: Score): { label: string; tone: BadgeTone } {
  return HEALTH_META[healthBand(score)];
}
