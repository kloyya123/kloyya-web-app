import { partitionInbox } from '@/lib/inbox-priority';
import { mockEmailInsights } from '@/mock/email-insights';
import { mockEmails } from '@/mock/organization';
import { API_STATUS } from '@/types/api';
import type { EmailInsights, EmailThread } from '@/types/domain';
import { mockError, mockRespond } from '../http/mock-transport';
import type { InboxList, InboxService } from './types';

/**
 * Mock inbox.
 *
 * Triage is delegated to the pure inbox-priority policy so the "does this need
 * me?" rule stays unit-tested in one place; the service only wires it to the
 * mock dataset and the transport. Insights are keyed separately and 404 when a
 * thread doesn't warrant them — the same absent-is-valid contract as briefings.
 */
export class MockInboxService implements InboxService {
  async listInbox(): Promise<InboxList> {
    const { needsAttention, everythingElse } = partitionInbox(mockEmails);
    const unreadCount = mockEmails.filter((email) => email.isUnread).length;

    const { data } = await mockRespond<InboxList>({
      needsAttention,
      everythingElse,
      unreadCount,
    });
    return data;
  }

  async getEmail(id: string): Promise<EmailThread> {
    const email = mockEmails.find((candidate) => candidate.id === id);
    if (!email) {
      mockError(
        API_STATUS.NotFound,
        'email_not_found',
        'That email no longer exists.',
        'It may have been archived, or the link may be out of date.',
        'Go back to your inbox for the current threads.',
      );
    }

    const { data } = await mockRespond(email);
    return data;
  }

  async getInsights(emailId: string): Promise<EmailInsights> {
    const insights = mockEmailInsights[emailId];
    if (!insights) {
      mockError(
        API_STATUS.NotFound,
        'email_insights_not_available',
        'No insights for this thread.',
        'Kloyya prepares replies and tasks for mail that needs a decision.',
        'Routine mail carries none.',
      );
    }

    const { data } = await mockRespond(insights);
    return data;
  }
}
