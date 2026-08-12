import { and, desc, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { syncRecords } from '@kloyya/db/schema';
import type { EmailThread } from '@kloyya/core';
import { partitionInbox } from '@/lib/inbox-priority';
import type { InboxList } from '@/services/inbox/types';
import type { StartContext } from '../tenant';

/**
 * The real inbox, built from Gmail messages the sync pipeline already landed.
 *
 * `services.inbox` used to be pinned to the mock regardless of
 * NEXT_PUBLIC_USE_REAL_API — every real workspace saw the same handful of demo
 * threads forever, no matter what actually synced. This reads `sync_records`
 * instead, the same table the dashboard's upcoming-meetings card reads.
 *
 * Threaded by Gmail's own `threadId` — one row per conversation, matching what
 * Gmail itself shows, not one row per message. Only Gmail's metadata shape is
 * parsed — any future mail connector lands under the same `message`
 * resourceType but would need its own parser for a different provider shape,
 * and stays out of the inbox until it has one — better an absent row than a
 * garbled one.
 *
 * WHAT IS REAL: subject, sender, received time, unread state — read straight
 * off the synced message. WHAT IS NOT YET: `aiSummary` is Gmail's own snippet
 * (not Kloyya's), and `importanceScore` / `importanceReason` / `needsReply`
 * are a plain unread-vs-read heuristic — no triage model runs over mail yet.
 * Both are honest stand-ins, not invented content, and this comment is the
 * seam to replace them from once real triage exists.
 */

const GMAIL_INTEGRATION_ID = 'gmail';

interface RawGmailHeader {
  name?: string;
  value?: string;
}

function headerValue(headers: unknown, name: string): string | null {
  if (!Array.isArray(headers)) return null;
  const lower = name.toLowerCase();
  for (const entry of headers as RawGmailHeader[]) {
    if (typeof entry?.name === 'string' && entry.name.toLowerCase() === lower) {
      return typeof entry.value === 'string' ? entry.value : null;
    }
  }
  return null;
}

/**
 * `"Priya Shah <priya@acme.com>"` -> `{ name: 'Priya Shah', email: 'priya@acme.com' }`.
 * Falls back to the raw string as both when it doesn't parse that way.
 */
function parseFrom(raw: string | null): { name: string; email: string } {
  if (!raw) return { name: 'Unknown sender', email: '' };
  const match = /^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/.exec(raw);
  if (match) {
    const name = match[1]?.trim() ?? '';
    const email = match[2]?.trim() ?? '';
    return { name: name.length > 0 ? name : email, email };
  }
  return { name: raw.trim(), email: raw.trim() };
}

interface SyncedMessageRow {
  externalId: string;
  payload: unknown;
  fetchedAt: Date;
}

/**
 * One thread, built from one landed message. Null when the payload doesn't
 * carry recognizable Gmail headers — a shape this parser doesn't own, not a
 * malformed record.
 */
function toThread(row: SyncedMessageRow, ctx: StartContext): { thread: EmailThread; threadKey: string } | null {
  if (!row.payload || typeof row.payload !== 'object') return null;
  const message = row.payload as Record<string, unknown>;
  const mime = message['payload'];
  const headers = mime && typeof mime === 'object' ? (mime as Record<string, unknown>)['headers'] : undefined;

  const subject = headerValue(headers, 'Subject');
  const from = parseFrom(headerValue(headers, 'From'));
  if (subject === null && from.email === '') return null;

  const internalDate = message['internalDate'];
  const receivedAt =
    typeof internalDate === 'string' && internalDate.length > 0 && !Number.isNaN(Number(internalDate))
      ? new Date(Number(internalDate)).toISOString()
      : row.fetchedAt.toISOString();

  const labelIds = Array.isArray(message['labelIds']) ? message['labelIds'] : [];
  const isUnread = labelIds.includes('UNREAD');
  const snippet = typeof message['snippet'] === 'string' ? message['snippet'] : '';
  const threadKey = typeof message['threadId'] === 'string' ? message['threadId'] : row.externalId;

  return {
    threadKey,
    thread: {
      id: threadKey,
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      // Synced content has no human author — named for where it came from.
      createdBy: GMAIL_INTEGRATION_ID,
      updatedBy: GMAIL_INTEGRATION_ID,
      createdAt: row.fetchedAt.toISOString(),
      updatedAt: row.fetchedAt.toISOString(),
      version: 1,
      subject: subject ?? '(no subject)',
      senderName: from.name,
      senderEmail: from.email,
      receivedAt,
      aiSummary: snippet,
      isUnread,
      importanceScore: isUnread ? 70 : 30,
      importanceReason: isUnread ? 'Unread in your mailbox' : 'Already read',
      needsReply: isUnread,
    },
  };
}

/**
 * All threads for the workspace, one per Gmail conversation. Rows arrive
 * newest-fetched first, so the first message seen for a given thread is its
 * most recent and wins; older messages in the same thread are dropped.
 */
/** Exported for server/search/service.ts — search indexes the same real threads. */
export async function loadThreads(db: AppDb, ctx: StartContext): Promise<EmailThread[]> {
  const rows = await withTenantScope(db, ctx.organizationId, (tx) =>
    tx
      .select({
        externalId: syncRecords.externalId,
        payload: syncRecords.payload,
        fetchedAt: syncRecords.fetchedAt,
      })
      .from(syncRecords)
      .where(
        and(
          eq(syncRecords.workspaceId, ctx.workspaceId),
          eq(syncRecords.integrationId, GMAIL_INTEGRATION_ID),
          eq(syncRecords.resourceType, 'message'),
          isNull(syncRecords.deletedAtSource),
        ),
      )
      .orderBy(desc(syncRecords.fetchedAt)),
  );

  const byThread = new Map<string, EmailThread>();
  for (const row of rows) {
    const built = toThread(row, ctx);
    if (!built) continue;
    if (!byThread.has(built.threadKey)) byThread.set(built.threadKey, built.thread);
  }
  return [...byThread.values()];
}

export async function getInboxList(db: AppDb, ctx: StartContext): Promise<InboxList> {
  const threads = await loadThreads(db, ctx);
  const { needsAttention, everythingElse } = partitionInbox(threads);
  return {
    needsAttention,
    everythingElse,
    unreadCount: threads.filter((thread) => thread.isUnread).length,
  };
}

export async function getEmailThread(db: AppDb, ctx: StartContext, id: string): Promise<EmailThread | null> {
  const threads = await loadThreads(db, ctx);
  return threads.find((thread) => thread.id === id) ?? null;
}
