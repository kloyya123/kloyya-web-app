import { beforeEach, describe, expect, it } from 'vitest';
import { isApiError } from '../http/errors';
import { configureMockTransport } from '../http/mock-transport';
import { MockInboxService } from './mock-inbox-service';

describe('MockInboxService', () => {
  const service = new MockInboxService();

  beforeEach(() => {
    // Determinism: no latency, no failure injection during assertions.
    configureMockTransport({ instant: true, failureRate: 0 });
  });

  describe('listInbox', () => {
    it('puts the highest-importance thread at the top of needs-attention', async () => {
      const { needsAttention } = await service.listInbox();
      expect(needsAttention.length).toBeGreaterThan(0);
      const scores = needsAttention.map((e) => e.importanceScore);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
      expect(needsAttention[0]?.id).toBe('email_acme_renewal');
    });

    it('keeps low-importance, no-reply mail out of needs-attention', async () => {
      const { needsAttention, everythingElse } = await service.listInbox();
      expect(needsAttention.some((e) => e.id === 'email_town_hall')).toBe(false);
      expect(everythingElse.some((e) => e.id === 'email_town_hall')).toBe(true);
    });

    it('counts unread across both buckets', async () => {
      const { needsAttention, everythingElse, unreadCount } = await service.listInbox();
      const actual = [...needsAttention, ...everythingElse].filter((e) => e.isUnread).length;
      expect(unreadCount).toBe(actual);
    });

    it('every thread carries a reason for its ranking', async () => {
      const { needsAttention, everythingElse } = await service.listInbox();
      for (const email of [...needsAttention, ...everythingElse]) {
        expect(email.importanceReason.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getEmail', () => {
    it('returns a known thread', async () => {
      const email = await service.getEmail('email_acme_renewal');
      expect(email.subject).toContain('Contract renewal');
    });

    it('throws a non-retryable 404 for an unknown id', async () => {
      await expect(service.getEmail('email_nope')).rejects.toSatisfy(
        (error: unknown) => isApiError(error) && error.httpStatus === 404 && !error.isRetryable,
      );
    });
  });

  describe('getInsights', () => {
    it('returns non-empty suggested replies for an actionable thread', async () => {
      const insights = await service.getInsights('email_acme_renewal');
      expect(insights.suggestedReplies.length).toBeGreaterThan(0);
    });

    it('throws 404 when a thread has no insights', async () => {
      await expect(service.getInsights('email_town_hall')).rejects.toSatisfy(
        (error: unknown) => isApiError(error) && error.httpStatus === 404,
      );
    });
  });
});
