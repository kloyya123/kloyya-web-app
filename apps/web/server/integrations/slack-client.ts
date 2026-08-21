/**
 * Reading Slack, incrementally, one conversation at a time.
 *
 * Slack has no single changes feed the way Gmail (historyId) or Microsoft
 * Graph (deltaLink) do. What it has is `conversations.history`, filterable by
 * `oldest` — so the same high-water-mark trick as Notion works here, except
 * the mark is per-workspace (the newest message timestamp seen across every
 * conversation), not per-conversation: simpler to store, and Slack timestamps
 * (`ts`) are already exact-to-the-microsecond strings that sort correctly.
 *
 * Slack's Web API is unusual: nearly every error comes back as HTTP 200 with
 * `{ ok: false, error: "..." }` in the body, not a 4xx/5xx. `slackGet` below is
 * the one place that distinction is made, so every caller can rely on a thrown
 * error meaning "this failed" regardless of which shape Slack chose to fail in.
 *
 * Deleted messages are not tombstoned. Slack's history API simply omits a
 * deleted message from later reads — there is no event saying "this is gone",
 * the way Gmail's history feed or Graph's delta feed both provide. Building a
 * deletion feed would mean diffing every conversation's full history against
 * what we last saw, which is a different (and much more expensive) sync than
 * this file does. Absence of a deletion signal, not silent data loss.
 */

/** Slack is briefly unavailable or rate-limiting. Worth retrying, not fatal. */
export class SlackTransientError extends Error {
  constructor(reason: string) {
    super(`Slack is temporarily unavailable (${reason}).`);
    this.name = 'SlackTransientError';
  }
}

/** The bot token no longer works — the app was removed, or the token expired. */
export class SlackUnauthorizedError extends Error {
  constructor() {
    super('Slack no longer accepts this connection.');
    this.name = 'SlackUnauthorizedError';
  }
}

/** Slack's own vocabulary for "this token is dead", not merely "this call failed". */
const REVOKED_ERRORS = new Set([
  'invalid_auth',
  'token_revoked',
  'account_inactive',
  'not_authed',
  'token_expired',
]);

interface SlackApiEnvelope {
  ok: boolean;
  error?: string;
  response_metadata?: { next_cursor?: string };
}

async function slackGet<T extends SlackApiEnvelope>(
  url: string,
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<T> {
  const response = await fetchImpl(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  // Slack does use a real 429 for rate limiting (with a Retry-After header),
  // and a real 5xx for its own outages — both worth retrying, not disconnecting.
  if (response.status === 429 || response.status >= 500) {
    throw new SlackTransientError(`HTTP ${response.status}`);
  }

  const body = (await response.json()) as T;
  if (!body.ok) {
    const reason = body.error ?? 'unknown error';
    if (REVOKED_ERRORS.has(reason)) throw new SlackUnauthorizedError();
    if (reason === 'ratelimited') throw new SlackTransientError('ratelimited');
    // A 4xx-shaped failure that isn't auth or rate-limiting is a bug in our
    // request, not a state a retry fixes.
    throw new Error(`Slack request failed: ${reason}`);
  }
  return body;
}

export interface RawSlackConversation {
  id: string;
  name?: string;
  is_im?: boolean;
  is_mpim?: boolean;
  is_private?: boolean;
}

interface ConversationsListResponse extends SlackApiEnvelope {
  channels?: RawSlackConversation[];
}

/**
 * Every conversation this bot can read — public and private channels it has
 * been invited to, DMs, and group DMs. Archived channels are excluded: a
 * channel nobody can post to any more has nothing new to sync.
 */
export async function listSlackConversations(params: {
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<RawSlackConversation[]> {
  const doFetch = params.fetchImpl ?? fetch;
  const conversations: RawSlackConversation[] = [];
  let cursor: string | undefined;

  for (;;) {
    const url = new URL('https://slack.com/api/conversations.list');
    url.searchParams.set('types', 'public_channel,private_channel,mpim,im');
    url.searchParams.set('exclude_archived', 'true');
    url.searchParams.set('limit', '200');
    if (cursor) url.searchParams.set('cursor', cursor);

    const page = await slackGet<ConversationsListResponse>(url.toString(), params.accessToken, doFetch);
    conversations.push(...(page.channels ?? []));

    cursor = page.response_metadata?.next_cursor;
    if (!cursor) break;
  }

  return conversations;
}

export interface RawSlackMessage {
  type?: string;
  /** Present on system messages (someone joined, a channel was renamed, …) — not conversation content. */
  subtype?: string;
  user?: string;
  text?: string;
  /** Slack's id for a message: a microsecond timestamp, unique within a conversation. */
  ts: string;
  thread_ts?: string;
  [key: string]: unknown;
}

interface ConversationsHistoryResponse extends SlackApiEnvelope {
  messages?: RawSlackMessage[];
  has_more?: boolean;
}

export interface SlackHistoryPage {
  messages: RawSlackMessage[];
  hasMore: boolean;
  nextCursor: string | undefined;
}

/** One page of one conversation's messages newer than `oldest`. The caller pages further and decides when to stop. */
export async function listSlackChannelHistory(params: {
  accessToken: string;
  channelId: string;
  oldest?: string;
  cursor?: string;
  fetchImpl?: typeof fetch;
}): Promise<SlackHistoryPage> {
  const doFetch = params.fetchImpl ?? fetch;
  const url = new URL('https://slack.com/api/conversations.history');
  url.searchParams.set('channel', params.channelId);
  url.searchParams.set('limit', '200');
  if (params.oldest) url.searchParams.set('oldest', params.oldest);
  if (params.cursor) url.searchParams.set('cursor', params.cursor);

  const page = await slackGet<ConversationsHistoryResponse>(url.toString(), params.accessToken, doFetch);
  return {
    messages: page.messages ?? [],
    hasMore: page.has_more ?? false,
    nextCursor: page.response_metadata?.next_cursor,
  };
}
