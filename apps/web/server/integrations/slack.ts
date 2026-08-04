import type { ProviderTokens } from './oauth';

/**
 * Slack OAuth.
 *
 * Bot Token Scopes, not user scopes: Kloyya installs as an app a workspace adds
 * to the channels it wants read, the same model as every other Slack
 * integration a team installs — not a personal grant on one member's account.
 * That keeps the connection meaningful even though a Slack "connection" in
 * Kloyya is really "the app was added to this workspace" rather than "this
 * person's own mailbox", the way Gmail/Calendar/Drive are.
 *
 * The bot token (xoxb-…) Slack returns does not expire and is not rotated
 * unless the app enables token rotation (it does not here), so — like Notion —
 * there is no refresh path to build.
 */
export const SLACK_AUTH_URL = 'https://slack.com/oauth/v2/authorize';
export const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';

/**
 * What Kloyya asks Slack for. All read-only. `channels:history` /
 * `groups:history` / `im:history` / `mpim:history` cover public channels,
 * private channels, DMs and group DMs respectively — a workspace only sees
 * data from the ones this app was actually invited into.
 */
export const SLACK_SCOPES: readonly string[] = [
  'channels:history',
  'channels:read',
  'groups:history',
  'groups:read',
  'im:history',
  'im:read',
  'mpim:history',
  'mpim:read',
  'users:read',
];

/** The one card this provider serves. */
export function isSlackIntegration(integrationId: string): boolean {
  return integrationId === 'slack';
}

/**
 * Where the installed Slack team's id lives in a connection's `syncCursors`.
 *
 * A live event from Slack's Events API carries a `team_id`, not a workspace or
 * organization id — this is how the webhook route finds which Kloyya
 * connection(s) an incoming event belongs to. Written once, at connect time
 * (see `exchangeSlackCode` below and `storeProviderTokens` in connect.ts).
 */
export const SLACK_TEAM_ID_KEY = 'slack:team_id';

export function buildSlackAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(SLACK_AUTH_URL);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', SLACK_SCOPES.join(','));
  url.searchParams.set('state', params.state);
  return url.toString();
}

interface SlackTokenResponse {
  ok: boolean;
  access_token?: string;
  scope?: string;
  error?: string;
  team?: { id?: string; name?: string };
}

/**
 * Trade the authorization code for a bot token.
 *
 * Slack's Web API is unusual among these connectors: failures come back as
 * HTTP 200 with `{ ok: false, error: "..." }`, not an error status — so `ok`
 * has to be checked explicitly, the same reasoning `slack-client.ts` documents
 * for the sync path.
 */
export async function exchangeSlackCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<ProviderTokens> {
  const doFetch = params.fetchImpl ?? fetch;

  const response = await doFetch(SLACK_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  const body = (await response.json()) as SlackTokenResponse;

  if (!body.ok || !body.access_token) {
    // Never echo the raw body: on some errors it can carry the code back.
    throw new Error(`Slack refused the token exchange: ${body.error ?? 'no access_token returned'}`);
  }

  return {
    accessToken: body.access_token,
    // Bot tokens don't expire and aren't refreshed (token rotation is off).
    refreshToken: null,
    expiresAt: null,
    // Believe Slack's answer, not our own request — it can grant less than asked.
    grantedScopes: body.scope ? body.scope.split(',').filter(Boolean) : [],
    ...(body.team?.id ? { metadata: { [SLACK_TEAM_ID_KEY]: body.team.id } } : {}),
  };
}
