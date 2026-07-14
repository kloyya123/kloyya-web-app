import type { EmailThread, Score } from '@/types/domain';

/**
 * Priority Inbox policy — the one place "does this need me?" is decided.
 *
 * The inbox is a triage surface, not a mail client (Design Manifesto: show the
 * one thread that changes the day, not forty). So it splits into two buckets
 * rather than sorting one long list: what needs attention, and everything else.
 *
 * Kept pure and out of the service so the rule is unit-testable in isolation and
 * a spec change to the threshold touches exactly this file — the same discipline
 * as decision-score and calendar-math.
 */

/**
 * The High band from KDSE (75). At or above it, a thread earns a place in "needs
 * attention" on importance alone; below it, only an outstanding reply pulls it up.
 */
export const NEEDS_ATTENTION_MIN = 75;

export type ImportanceTier = 'critical' | 'high' | 'normal';

/** A thread needs attention if it's important enough, or it's simply owed a reply. */
export function needsAttention(email: EmailThread): boolean {
  return email.importanceScore >= NEEDS_ATTENTION_MIN || email.needsReply;
}

/** Display band for an importance score. Mirrors the KDSE Critical/High cutoffs. */
export function importanceTier(score: Score): ImportanceTier {
  if (score >= 90) return 'critical';
  if (score >= NEEDS_ATTENTION_MIN) return 'high';
  return 'normal';
}

export interface InboxPartition {
  /** Importance desc, then most-recent first. */
  needsAttention: EmailThread[];
  /** Most-recent first; importance is not a factor here. */
  everythingElse: EmailThread[];
}

const byRecentDesc = (a: EmailThread, b: EmailThread) =>
  b.receivedAt.localeCompare(a.receivedAt);

/**
 * Partition the inbox into the two triage buckets. Does not mutate its input —
 * sorting happens on copies, so a caller holding the raw list keeps its order.
 */
export function partitionInbox(emails: readonly EmailThread[]): InboxPartition {
  const needs: EmailThread[] = [];
  const rest: EmailThread[] = [];
  for (const email of emails) {
    (needsAttention(email) ? needs : rest).push(email);
  }

  needs.sort((a, b) => b.importanceScore - a.importanceScore || byRecentDesc(a, b));
  rest.sort(byRecentDesc);

  return { needsAttention: needs, everythingElse: rest };
}
