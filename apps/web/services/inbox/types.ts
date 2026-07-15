import type { EmailInsights, EmailThread } from '@/types/domain';

export interface InboxList {
  /** Threads that need you, importance desc then most-recent. */
  needsAttention: EmailThread[];
  /** Everything else, most-recent first. */
  everythingElse: EmailThread[];
  /** Unread across both buckets — drives the nav badge and the header count. */
  unreadCount: number;
}

/**
 * The inbox contract.
 *
 * A real backend feeds this from the mail connectors (Gmail / Outlook via the
 * Connection Manager): threads sync in, the triage agent scores importance and
 * writes the reason, and per-thread insights — suggested replies, extracted
 * tasks, detected meetings — are generated on read. The shape here is that end
 * state; only the transport changes.
 */
export interface InboxService {
  listInbox(): Promise<InboxList>;

  /** Throws 404 for an unknown id. */
  getEmail(id: string): Promise<EmailThread>;

  /**
   * Per-thread AI insights. Throws 404 when none exist — routine mail carries
   * no suggested replies or extracted tasks, and that absence is expected.
   */
  getInsights(emailId: string): Promise<EmailInsights>;
}
