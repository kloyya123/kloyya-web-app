import type { Score } from '@/types/domain';
import { clampScore } from './decision-score';

/**
 * Confidence presentation.
 *
 * No Kloyya document defines confidence bands. DCTF, KARE, and DIE all express
 * confidence as a bare percentage; only *priority* has specified bands (KDSE).
 * KAOP specifies behavior at a threshold but never names the threshold.
 *
 * So the bands below are derived, and isolated here precisely because they are
 * derived: when the spec pins them down, this is the only file that changes.
 *
 * The two thresholds are the only numbers the documents do imply:
 *
 *   AUTOMATION_THRESHOLD (90) — the Automation Engine's own condition example is
 *   "Only if confidence > 90%", and it states "only high-confidence automations
 *   should execute automatically. Others require approval."
 *
 *   REVIEW_THRESHOLD (60) — below this, KAOP's hallucination-detection rule
 *   applies: "Warn user, reduce automation, request clarification, escalate to
 *   human review." DCTF: "Trust always takes priority over speed."
 */

export const AUTOMATION_THRESHOLD = 90;
export const REVIEW_THRESHOLD = 60;

export const CONFIDENCE_BANDS = ['high', 'moderate', 'limited', 'low'] as const;
export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

export interface ConfidencePresentation {
  band: ConfidenceBand;
  /** 0–100, clamped. */
  score: Score;
  /** Short label for the badge, e.g. "94% confident". */
  label: string;
  /**
   * The sentence shown when the user asks what the number means.
   * DCTF: "Never hide uncertainty." A percentage alone hides it behind a number.
   */
  explanation: string;
  /** Below REVIEW_THRESHOLD. The UI must visibly caveat the recommendation. */
  requiresReview: boolean;
  /** At or above AUTOMATION_THRESHOLD. Automation may run without approval. */
  permitsAutomation: boolean;
}

function bandFor(score: Score): ConfidenceBand {
  if (score >= AUTOMATION_THRESHOLD) return 'high';
  if (score >= 75) return 'moderate';
  if (score >= REVIEW_THRESHOLD) return 'limited';
  return 'low';
}

const EXPLANATIONS: Record<ConfidenceBand, string> = {
  high: 'Supported by multiple recent, consistent sources.',
  moderate: 'Well supported, though some sources are older or incomplete.',
  limited: 'Based on partial evidence. Worth verifying before you act.',
  low: 'Evidence is thin or sources disagree. Review this before acting on it.',
};

export function presentConfidence(rawScore: number): ConfidencePresentation {
  const score = clampScore(rawScore);
  const band = bandFor(score);

  return {
    band,
    score,
    // Rounded for display only. The underlying score keeps its precision.
    label: `${Math.round(score)}% confident`,
    explanation: EXPLANATIONS[band],
    requiresReview: score < REVIEW_THRESHOLD,
    permitsAutomation: score >= AUTOMATION_THRESHOLD,
  };
}
