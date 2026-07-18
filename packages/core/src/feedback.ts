/**
 * Beta feedback vocabulary.
 *
 * Shared so the Community & Feedback form offers exactly what the API accepts —
 * one definition, both ends, no drift between the dropdown and the validator.
 */
export const FEEDBACK_TYPES = ['feature_request', 'bug', 'general'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_CATEGORIES = [
  'ai',
  'search',
  'workspace',
  'tasks',
  'projects',
  'documents',
  'integrations',
  'mobile',
  'performance',
  'design',
  'other',
] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

/** The running tallies shown on the beta-status panel. */
export interface FeedbackSummary {
  featureRequests: number;
  bugsReported: number;
  generalFeedback: number;
  total: number;
}
