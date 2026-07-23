import { NOTION_API, NOTION_VERSION } from './notion';

/**
 * Reading Notion, incrementally, without a delta cursor.
 *
 * Notion's API has no changes feed and no sync token. What it does have is a
 * search endpoint that returns every page and database shared with the
 * integration, and lets us sort by last_edited_time descending. That is enough to
 * fake a delta: remember the newest last_edited_time we saw, and next time walk
 * from the top and stop the moment we reach something that old. Everything above
 * the line changed since; everything below it did not.
 *
 * The cursor, then, is a timestamp — a high-water mark — not an opaque token. It
 * is exact enough for our purpose and survives a Notion outage without aging out,
 * which an opaque token would not.
 *
 * Only metadata and property values come back here; page content lives in blocks
 * we never fetch. There is nothing to interpret and nothing to leak.
 */

/** Notion is briefly unavailable or rate-limiting. Not the connection's fault. */
export class NotionTransientError extends Error {
  constructor(status: number) {
    super(`Notion is temporarily unavailable (HTTP ${status}).`);
    this.name = 'NotionTransientError';
  }
}

/** Notion no longer accepts this token — the user revoked the integration. */
export class NotionUnauthorizedError extends Error {
  constructor() {
    super('Notion no longer accepts this connection.');
    this.name = 'NotionUnauthorizedError';
  }
}

export interface RawNotionItem {
  object: string;
  id: string;
  last_edited_time?: string;
  archived?: boolean;
  in_trash?: boolean;
  [key: string]: unknown;
}

interface NotionSearchResponse {
  results?: RawNotionItem[];
  next_cursor?: string | null;
  has_more?: boolean;
}

async function notionSearch(params: {
  accessToken: string;
  startCursor?: string;
  fetchImpl?: typeof fetch;
}): Promise<NotionSearchResponse> {
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(`${NOTION_API}/search`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      'content-type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify({
      // Newest edits first — the whole incremental scheme rests on this order.
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: 100,
      ...(params.startCursor ? { start_cursor: params.startCursor } : {}),
    }),
  });

  if (response.status === 401) throw new NotionUnauthorizedError();
  if (response.status === 429 || response.status >= 500) {
    throw new NotionTransientError(response.status);
  }
  if (!response.ok) {
    // A 4xx that isn't auth or rate-limit is a bug in our request, not a state a
    // retry fixes — surface it rather than silently returning nothing.
    throw new Error(`Notion search failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as NotionSearchResponse;
}

export interface NotionPage {
  /** Live items whose last_edited_time is newer than `since`. */
  items: RawNotionItem[];
  /** The newest last_edited_time seen this run — the next high-water mark. */
  newWatermark: string | null;
}

/**
 * Walk search from the top, newest first, stopping at the high-water mark.
 *
 * `since` is the last run's watermark. Because results descend by edit time, the
 * first item at or below `since` means everything after it is older too, so we
 * stop — no need to page to the end of a workspace on every sync. On a first sync
 * `since` is undefined and we read everything shared with us, bounded by
 * `maxItems` so an enormous workspace can't run unbounded inline.
 */
export async function listNotionChanges(params: {
  accessToken: string;
  since?: string;
  maxItems?: number;
  fetchImpl?: typeof fetch;
}): Promise<NotionPage> {
  const cap = params.maxItems ?? 1000;
  const items: RawNotionItem[] = [];
  let newWatermark: string | null = null;
  let startCursor: string | undefined;

  for (;;) {
    const page = await notionSearch({
      accessToken: params.accessToken,
      ...(startCursor ? { startCursor } : {}),
      ...(params.fetchImpl ? { fetchImpl: params.fetchImpl } : {}),
    });
    const results = page.results ?? [];

    let reachedOld = false;
    for (const item of results) {
      const edited = item.last_edited_time ?? '';
      // ISO-8601 timestamps compare correctly as strings; the newest is the max.
      if (newWatermark === null || edited > newWatermark) newWatermark = edited;

      if (params.since && edited && edited <= params.since) {
        reachedOld = true;
        break;
      }
      items.push(item);
      if (items.length >= cap) {
        reachedOld = true;
        break;
      }
    }

    if (reachedOld || !page.has_more || !page.next_cursor) break;
    startCursor = page.next_cursor;
  }

  return { items, newWatermark };
}

/** Archived or trashed in Notion is our tombstone — "this page was removed". */
export function isNotionRemoval(item: RawNotionItem): boolean {
  return item.archived === true || item.in_trash === true;
}
