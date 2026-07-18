import type { FeedbackSummary } from '@kloyya/core';
import { now } from '@/lib/clock';
import { mockRespond } from '../http/mock-transport';
import type { FeedbackInput, FeedbackReceipt, FeedbackService } from './types';

/**
 * The mock feedback service.
 *
 * An in-memory tally so the Community & Feedback screen — the three forms and the
 * beta-status counters — works without a backend. Counts persist for the session
 * and rise as you submit, so the "you've submitted N" panel is live.
 */
const counts = { feature_request: 0, bug: 0, general: 0 };

export class MockFeedbackService implements FeedbackService {
  async submit(input: FeedbackInput): Promise<FeedbackReceipt> {
    counts[input.type] += 1;
    return (
      await mockRespond<FeedbackReceipt>({
        id: crypto.randomUUID(),
        type: input.type,
        createdAt: now().toISOString(),
      })
    ).data;
  }

  async summary(): Promise<FeedbackSummary> {
    return (
      await mockRespond<FeedbackSummary>({
        featureRequests: counts.feature_request,
        bugsReported: counts.bug,
        generalFeedback: counts.general,
        total: counts.feature_request + counts.bug + counts.general,
      })
    ).data;
  }
}
