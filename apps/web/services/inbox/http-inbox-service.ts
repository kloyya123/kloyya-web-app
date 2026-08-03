import type { EmailInsights, EmailThread } from '@/types/domain';
import { apiFetch } from '../http/transport';
import type { InboxList, InboxService } from './types';

/** The real InboxService — maps one-to-one onto /v1/inbox/*. */
export class HttpInboxService implements InboxService {
  async listInbox(): Promise<InboxList> {
    return apiFetch<InboxList>('/v1/inbox');
  }

  async getEmail(id: string): Promise<EmailThread> {
    return apiFetch<EmailThread>(`/v1/inbox/${encodeURIComponent(id)}`);
  }

  async getInsights(emailId: string): Promise<EmailInsights> {
    return apiFetch<EmailInsights>(`/v1/inbox/${encodeURIComponent(emailId)}/insights`);
  }
}
