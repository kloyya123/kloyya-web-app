import { sql } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { waitlist } from '@kloyya/db/schema';

/**
 * The private-beta waiting list.
 *
 * Two destinations, on purpose:
 *
 *   Postgres is the RECORD. It is ours, it is queryable, it survives us
 *   changing email provider, and it is what the invite process reads from.
 *
 *   The Resend audience is the SENDING MECHANISM — an address that only exists
 *   in our database is one we cannot actually mail without exporting it by hand.
 *
 * The database write is authoritative and the Resend call is best-effort. If
 * Resend is down or misconfigured, the person is still on the list and we can
 * reconcile later; losing their signup because a third party had a bad minute
 * would be the worse failure. `reconcileToResend` exists for that backfill.
 */

/** Lower-cased and trimmed: an address is one identity however it was typed. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface JoinResult {
  /** False when the address was already on the list — not an error. */
  isNew: boolean;
}

/**
 * Add an address to the list, or quietly do nothing if it is already there.
 *
 * Signing up twice is enthusiasm, not a conflict, so this upserts and reports
 * which happened rather than throwing. The caller says the same thing to the
 * visitor either way — telling someone "you already signed up" leaks who is on
 * the list to anyone willing to guess addresses.
 */
export async function joinWaitlist(
  db: AppDb,
  email: string,
  source: string,
): Promise<JoinResult> {
  const address = normaliseEmail(email);

  // xmax = 0 identifies a genuine INSERT; a non-zero xmax means this row was
  // updated by the conflict branch. It is the standard way to distinguish the
  // two without a second round trip.
  const rows = await db
    .insert(waitlist)
    .values({ email: address, source })
    .onConflictDoUpdate({
      target: waitlist.email,
      set: { updatedAt: new Date() },
    })
    .returning({ inserted: sql<boolean>`(xmax = 0)` });

  return { isNew: rows[0]?.inserted ?? false };
}

/**
 * Mirror an address into the Resend audience so it can actually be emailed.
 *
 * Best-effort by contract: every failure path returns rather than throws, and
 * the caller does not await the outcome for correctness. A missing key (local
 * dev, tests) is a no-op, not an error.
 */
export async function addToResendAudience(
  email: string,
  opts: { apiKey?: string | undefined; audienceId?: string | undefined; fetchImpl?: typeof fetch },
): Promise<void> {
  const { apiKey, audienceId } = opts;
  if (!apiKey || !audienceId) return;

  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const response = await doFetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: normaliseEmail(email), unsubscribed: false }),
    });
    if (!response.ok) {
      // 409 means the contact already exists, which is the expected outcome for
      // a repeat signup and not worth a log line.
      if (response.status !== 409) {
        console.warn('[waitlist] Resend rejected the contact', response.status);
      }
    }
  } catch (error) {
    console.warn('[waitlist] could not reach Resend', error);
  }
}
