import { googleGet, GoogleTransientError, SyncTokenExpiredError } from './google-http';

/**
 * The Gmail API, read-only.
 *
 * Gmail is unlike Calendar in two ways that shape everything here:
 *
 *  1. Listing gives you ids, not messages. Every message needs its own GET, so a
 *     mailbox costs N+1 requests. We fetch `metadata` rather than `full` — headers,
 *     labels, snippet — because the pipeline reasons about who mailed whom about
 *     what, and downloading every attachment body to answer that would be a
 *     quota bonfire for data we don't use.
 *  2. Incremental sync is a historyId, not a syncToken, and Gmail expires it after
 *     about a week. An expired historyId is a 404, not a 410 — the same meaning
 *     in a different costume, so it is translated here rather than leaking a
 *     Gmail-shaped error into the sync engine.
 */
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/** A message, exactly as Gmail returns it. */
export interface RawGmailMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  [key: string]: unknown;
}

interface ListResponse {
  messages?: { id: string }[];
  nextPageToken?: string;
}

interface HistoryResponse {
  history?: { messagesAdded?: { message: { id: string } }[]; messagesDeleted?: { message: { id: string } }[] }[];
  historyId?: string;
  nextPageToken?: string;
}

/** The mailbox's current historyId — where the NEXT incremental sync resumes. */
export async function getMailboxHistoryId(params: {
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  const body = await googleGet<{ historyId?: string }>(
    `${GMAIL_API}/profile`,
    params.accessToken,
    params.fetchImpl ?? fetch,
  );
  return body.historyId ?? null;
}

export interface GmailChanges {
  /** Ids to fetch and land. */
  changed: string[];
  /** Ids Gmail says are gone. */
  deleted: string[];
}

/**
 * Everything that changed since `startHistoryId`.
 *
 * Gmail's history is a log of events, not a list of messages: the same id can
 * appear added and deleted across pages, so ids are collected into sets and the
 * deletions win — a message deleted after being added is deleted.
 */
export async function listGmailHistory(params: {
  accessToken: string;
  startHistoryId: string;
  fetchImpl?: typeof fetch;
  maxPages?: number;
}): Promise<GmailChanges & { nextHistoryId: string | null }> {
  const doFetch = params.fetchImpl ?? fetch;
  const changed = new Set<string>();
  const deleted = new Set<string>();
  let pageToken: string | undefined;
  let nextHistoryId: string | null = null;

  for (let page = 0; page < (params.maxPages ?? 25); page += 1) {
    const url = new URL(`${GMAIL_API}/history`);
    url.searchParams.set('startHistoryId', params.startHistoryId);
    url.searchParams.set('maxResults', '500');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    let body: HistoryResponse;
    try {
      body = await googleGet<HistoryResponse>(url.toString(), params.accessToken, doFetch);
    } catch (error) {
      // Gmail answers 404 for a historyId it has aged out. That is the same
      // situation Calendar reports as 410: our cursor is too old, re-read whole.
      if (error instanceof Error && /404/.test(error.message)) throw new SyncTokenExpiredError();
      throw error;
    }

    for (const record of body.history ?? []) {
      for (const added of record.messagesAdded ?? []) changed.add(added.message.id);
      for (const gone of record.messagesDeleted ?? []) {
        deleted.add(gone.message.id);
        changed.delete(gone.message.id);
      }
    }

    if (body.historyId) nextHistoryId = body.historyId;
    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }

  return { changed: [...changed], deleted: [...deleted], nextHistoryId };
}

/**
 * The recent mailbox, for a first sync.
 *
 * Bounded by `newer_than` so connecting Kloyya doesn't drag in a decade of mail
 * nobody asked it to read — and, just as importantly, doesn't spend an hour of
 * quota before the user sees anything work.
 */
export async function listRecentMessageIds(params: {
  accessToken: string;
  days: number;
  fetchImpl?: typeof fetch;
  maxPages?: number;
}): Promise<string[]> {
  const doFetch = params.fetchImpl ?? fetch;
  const ids: string[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < (params.maxPages ?? 10); page += 1) {
    const url = new URL(`${GMAIL_API}/messages`);
    url.searchParams.set('q', `newer_than:${params.days}d`);
    url.searchParams.set('maxResults', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const body = await googleGet<ListResponse>(url.toString(), params.accessToken, doFetch);
    for (const message of body.messages ?? []) ids.push(message.id);

    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }

  return ids;
}

/**
 * One message, as metadata.
 *
 * Returns null for a 404: between listing and fetching, a user can delete a
 * message. That is an ordinary race, not a failure — losing the whole sync
 * because one mail vanished mid-read would be absurd.
 */
export async function getMessage(params: {
  accessToken: string;
  id: string;
  fetchImpl?: typeof fetch;
}): Promise<RawGmailMessage | null> {
  const url = new URL(`${GMAIL_API}/messages/${encodeURIComponent(params.id)}`);
  url.searchParams.set('format', 'metadata');
  for (const header of ['From', 'To', 'Cc', 'Subject', 'Date', 'Message-ID']) {
    url.searchParams.append('metadataHeaders', header);
  }

  try {
    return await googleGet<RawGmailMessage>(url.toString(), params.accessToken, params.fetchImpl ?? fetch);
  } catch (error) {
    if (error instanceof GoogleTransientError) throw error;
    if (error instanceof Error && /404/.test(error.message)) return null;
    throw error;
  }
}
