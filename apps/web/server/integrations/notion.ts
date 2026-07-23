import type { ProviderTokens } from './oauth';

/**
 * Notion OAuth and the Notion API.
 *
 * The odd one out among the connectors, in three ways that shape everything here:
 *
 *  • The token exchange authenticates with HTTP Basic (client_id:client_secret in
 *    the Authorization header) and a JSON body — not the form-encoded body Google
 *    and Microsoft use.
 *  • The access token never expires and there is no refresh token. A Notion grant
 *    lives until the user revokes it in their Notion settings, so there is no
 *    refresh path to build — and no refresh token to store.
 *  • There are no OAuth scopes. Access is per-page: the integration sees exactly
 *    the pages and databases a user has shared with it, and nothing else. So the
 *    "did they grant what we asked?" check every other provider runs has nothing
 *    to check.
 *
 * Every request carries a Notion-Version header; the API refuses requests without
 * one, and pins behaviour to a dated contract so a Notion change can't silently
 * reshape what we read.
 */
export const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
export const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';
export const NOTION_API = 'https://api.notion.com/v1';
/** The dated API contract we read against. Sent on every request. */
export const NOTION_VERSION = '2022-06-28';

/** The one card this provider serves. */
export function isNotionIntegration(integrationId: string): boolean {
  return integrationId === 'notion';
}

export function buildNotionAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(NOTION_AUTH_URL);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  // owner=user is Notion's required value — the grant is owned by the person who
  // approves it, not by a workspace bot acting on its own.
  url.searchParams.set('owner', 'user');
  url.searchParams.set('state', params.state);
  return url.toString();
}

interface NotionTokenResponse {
  access_token?: string;
  workspace_id?: string;
  workspace_name?: string;
  bot_id?: string;
  error?: string;
  error_description?: string;
}

/**
 * Trade the authorization code for an access token.
 *
 * Notion authenticates the app itself with Basic auth here, so the client secret
 * rides in the header rather than the body. The returned token is all we get and
 * all we need — there is no expiry and no refresh token, which is why the tokens
 * we hand back carry a null refreshToken and null expiresAt, and why nothing
 * downstream ever tries to refresh a Notion connection.
 */
export async function exchangeNotionCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<ProviderTokens> {
  const doFetch = params.fetchImpl ?? fetch;
  const basic = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64');

  const response = await doFetch(NOTION_TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  });

  const body = (await response.json()) as NotionTokenResponse;
  if (body.error || !body.access_token) {
    // Never echo the body — it carries the code, and the header carried the secret.
    throw new Error(`Notion refused the token exchange: ${body.error ?? 'no access_token'}`);
  }

  return {
    accessToken: body.access_token,
    // Notion tokens do not expire and there is no refresh token.
    refreshToken: null,
    expiresAt: null,
    // Notion has no OAuth scopes; access is per-page, granted in its own UI.
    grantedScopes: [],
  };
}
