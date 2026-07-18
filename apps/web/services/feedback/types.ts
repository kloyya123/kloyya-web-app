import type { FeedbackCategory, FeedbackSummary, FeedbackType } from '@kloyya/core';

/**
 * Beta feedback — the Community & Feedback screen's contract.
 */
export interface FeedbackInput {
  type: FeedbackType;
  title: string;
  body: string;
  category?: FeedbackCategory;
  rating?: number;
  details?: Record<string, unknown>;
}

export interface FeedbackReceipt {
  id: string;
  type: FeedbackType;
  createdAt: string;
}

export interface FeedbackService {
  submit(input: FeedbackInput): Promise<FeedbackReceipt>;
  summary(): Promise<FeedbackSummary>;
}
