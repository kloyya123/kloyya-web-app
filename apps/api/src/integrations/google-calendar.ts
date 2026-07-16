/**
 * The Google Calendar API, as much of it as a read-only connector needs.
 *
 * Deliberately thin: it fetches and hands back what Google said, unedited. The
 * shaping happens nowhere — raw payloads land in sync_records and the pipeline
 * interprets them later.
 */
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/**
 * Google expired our sync token.
 *
 * It answers 410 when a syncToken is too old or the calendar changed in a way it
 * can't express incrementally. The only cure is to forget the cursor and re-read
 * the calendar in full. Treating this as an ordinary error would leave a
 * connection permanently stuck on a token Google will never accept again.
 */
export class SyncTokenExpiredError extends Error {
  constructor() {
    super('Google expired the sync token; a full resync is required.');
    this.name = 'SyncTokenExpiredError';
  }
}

/** Google is rate-limiting or briefly broken. Worth retrying; not worth panicking. */
export class GoogleTransientError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GoogleTransientError';
  }
}

export interface GoogleCalendarSummary {
  id: string;
  summary: string;
  primary?: boolean;
}

/** A Calendar event, exactly as Google returns it. Not our shape; theirs. */
export interface RawGoogleEvent {
  id: string;
  status?: string;
  [key: string]: unknown;
}

interface EventsPage {
  items?: RawGoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

async function googleGet<T>(
  url: string,
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<T> {
  const response = await fetchImpl(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 410) throw new SyncTokenExpiredError();

  // 429 and 5xx are Google having a moment. A connector that treats them as
  // fatal disconnects customers over a blip.
  if (response.status === 429 || response.status >= 500) {
    throw new GoogleTransientError(`Google returned ${response.status}`, response.status);
  }

  if (!response.ok) {
    // 401/403 here mean the grant no longer covers this call — a real problem the
    // caller must surface, not retry.
    throw new Error(`Google Calendar request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

/** The calendars this account can read. */
export async function listCalendars(params: {
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<GoogleCalendarSummary[]> {
  const doFetch = params.fetchImpl ?? fetch;
  const url = new URL(`${CALENDAR_API}/users/me/calendarList`);
  // We only ever read; asking for less is asking for less.
  url.searchParams.set('minAccessRole', 'reader');

  const body = await googleGet<{ items?: GoogleCalendarSummary[] }>(
    url.toString(),
    params.accessToken,
    doFetch,
  );
  return body.items ?? [];
}

export interface EventsResult {
  events: RawGoogleEvent[];
  /** Where the next incremental sync should resume. */
  nextSyncToken: string | null;
}

/**
 * Every event on a calendar since `syncToken`, following pagination to the end.
 *
 * Google only issues `nextSyncToken` on the FINAL page — stopping early loses
 * the cursor and forces a full resync next time, which is how a "cheap
 * incremental sync" quietly becomes a full download on every run.
 *
 * Without a syncToken this is a full read, bounded by `timeMin` so a first sync
 * doesn't drag in a decade of history nobody asked for.
 */
export async function listEvents(params: {
  accessToken: string;
  calendarId: string;
  syncToken?: string | undefined;
  /** Only used on a full read; ignored by Google when a syncToken is present. */
  timeMin?: string | undefined;
  fetchImpl?: typeof fetch;
  /** Safety valve so one enormous calendar can't loop forever. */
  maxPages?: number;
}): Promise<EventsResult> {
  const doFetch = params.fetchImpl ?? fetch;
  const maxPages = params.maxPages ?? 25;

  const events: RawGoogleEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(`${CALENDAR_API}/calendars/${encodeURIComponent(params.calendarId)}/events`);
    url.searchParams.set('maxResults', '250');
    // Recurring events are expanded into instances: the pipeline reasons about
    // "the 3pm on Tuesday", not an RRULE it would have to evaluate itself.
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('showDeleted', 'true');

    if (params.syncToken) {
      url.searchParams.set('syncToken', params.syncToken);
    } else if (params.timeMin) {
      url.searchParams.set('timeMin', params.timeMin);
    }
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const body = await googleGet<EventsPage>(url.toString(), params.accessToken, doFetch);
    events.push(...(body.items ?? []));

    if (body.nextPageToken) {
      pageToken = body.nextPageToken;
      continue;
    }
    nextSyncToken = body.nextSyncToken ?? null;
    break;
  }

  return { events, nextSyncToken };
}

/** Google marks a deletion by status, not by omission. */
export function isCancelled(event: RawGoogleEvent): boolean {
  return event.status === 'cancelled';
}
