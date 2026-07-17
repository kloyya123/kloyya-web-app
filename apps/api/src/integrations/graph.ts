import { GRAPH_API } from './microsoft.js';
import { SyncTokenExpiredError } from './google-http.js';

/**
 * Microsoft Graph, read-only, over its delta APIs.
 *
 * Graph's incremental model puts the cursor in the RESPONSE: the final page of a
 * delta query carries an `@odata.deltaLink`, an opaque URL you call verbatim next
 * time to get only what changed since. So the cursor we persist is a whole URL,
 * not a token we reassemble — and an expired one comes back as 410
 * resyncRequired, which the sync treats exactly like Google's 410: forget it and
 * read whole.
 */
export { SyncTokenExpiredError };

/** Graph is rate-limiting or briefly down — retry, don't panic. */
export class GraphTransientError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GraphTransientError';
  }
}

/** A Graph resource, verbatim. `@removed` marks a deletion in a delta feed. */
export interface RawGraphItem {
  id: string;
  '@removed'?: { reason?: string };
  [key: string]: unknown;
}

interface DeltaResponse {
  value?: RawGraphItem[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

async function graphGet<T>(url: string, accessToken: string, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  // A stale deltaLink: same meaning as Google's 410 — our cursor is too old.
  if (response.status === 410) throw new SyncTokenExpiredError();
  if (response.status === 429 || response.status >= 500) {
    throw new GraphTransientError(`Graph returned ${response.status}`, response.status);
  }
  if (!response.ok) {
    throw new Error(`Graph request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export interface DeltaResult {
  /** Live items to validate and land. */
  items: RawGraphItem[];
  /** Ids Graph says are gone. */
  removed: string[];
  /** The URL where the next incremental sync resumes. */
  nextDeltaLink: string | null;
}

/**
 * Walk a Graph delta feed to the end.
 *
 * `@odata.nextLink` pages through the current batch; only the last page carries
 * `@odata.deltaLink`, the cursor — so stopping early loses it and forces a full
 * resync, the same trap as Gmail's history and Drive's page token. Removals are
 * separated from live items so the caller can tombstone one and land the other.
 */
async function walkDelta(params: {
  firstUrl: string;
  accessToken: string;
  fetchImpl: typeof fetch;
  maxPages: number;
}): Promise<DeltaResult> {
  const items: RawGraphItem[] = [];
  const removed: string[] = [];
  let url: string | undefined = params.firstUrl;
  let nextDeltaLink: string | null = null;

  for (let page = 0; page < params.maxPages && url; page += 1) {
    const body: DeltaResponse = await graphGet<DeltaResponse>(url, params.accessToken, params.fetchImpl);

    for (const item of body.value ?? []) {
      if (item['@removed']) removed.push(item.id);
      else items.push(item);
    }

    if (body['@odata.nextLink']) {
      url = body['@odata.nextLink'];
      continue;
    }
    nextDeltaLink = body['@odata.deltaLink'] ?? null;
    break;
  }

  return { items, removed, nextDeltaLink };
}

/** Outlook mail metadata. $select keeps this to who/what/when, not message bodies. */
const MAIL_SELECT = 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,isRead,conversationId,webLink';

export async function listOutlookMailDelta(params: {
  accessToken: string;
  deltaLink?: string | undefined;
  fetchImpl?: typeof fetch;
  maxPages?: number;
}): Promise<DeltaResult> {
  const first =
    params.deltaLink ??
    `${GRAPH_API}/me/mailFolders/inbox/messages/delta?$select=${encodeURIComponent(MAIL_SELECT)}`;

  return walkDelta({
    firstUrl: first,
    accessToken: params.accessToken,
    fetchImpl: params.fetchImpl ?? fetch,
    maxPages: params.maxPages ?? 25,
  });
}

/**
 * Outlook calendar events via calendarView delta.
 *
 * calendarView expands recurrences into instances (like Calendar's singleEvents)
 * and needs a start/end window on the FIRST request only — after that the
 * deltaLink carries it. Bounded so a first sync doesn't drag in years of history.
 */
export async function listOutlookCalendarDelta(params: {
  accessToken: string;
  deltaLink?: string | undefined;
  windowDays: number;
  fetchImpl?: typeof fetch;
  maxPages?: number;
  now?: () => number;
}): Promise<DeltaResult> {
  let first: string;
  if (params.deltaLink) {
    first = params.deltaLink;
  } else {
    const nowMs = (params.now ?? Date.now)();
    const start = new Date(nowMs - params.windowDays * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(nowMs + params.windowDays * 24 * 60 * 60 * 1000).toISOString();
    const qs = new URLSearchParams({ startDateTime: start, endDateTime: end });
    first = `${GRAPH_API}/me/calendarView/delta?${qs.toString()}`;
  }

  return walkDelta({
    firstUrl: first,
    accessToken: params.accessToken,
    fetchImpl: params.fetchImpl ?? fetch,
    maxPages: params.maxPages ?? 25,
  });
}
