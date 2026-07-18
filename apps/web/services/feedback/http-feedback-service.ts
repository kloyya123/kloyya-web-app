import type { FeedbackSummary } from '@kloyya/core';
import { apiFetch } from '../http/transport';
import type { FeedbackInput, FeedbackReceipt, FeedbackService } from './types';

/** The real feedback service — submit and read tallies over /v1/feedback. */
export class HttpFeedbackService implements FeedbackService {
  async submit(input: FeedbackInput): Promise<FeedbackReceipt> {
    return apiFetch<FeedbackReceipt>('/v1/feedback', { method: 'POST', body: input });
  }

  async summary(): Promise<FeedbackSummary> {
    return apiFetch<FeedbackSummary>('/v1/feedback/summary');
  }
}
