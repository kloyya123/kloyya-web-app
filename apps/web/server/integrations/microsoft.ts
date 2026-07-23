import { AuthRevokedError, type RefreshedToken } from './oauth';

/**
 * Microsoft OAuth (Entra ID / Azure AD) and the Graph API.
 *
 * A different provider from Google in every way that matters here:
 *
 *  • Endpoints carry the `common` tenant, so a personal Microsoft account and a
 *    work/school account both sign in through the same app. (The user confirmed
 *    the app is multi-tenant.)
 *  • A refresh token only comes back if `offline_access` is among the scopes —
 *    the same trap as Google's access_type=offline, in different clothing.
 *  • The Graph delta APIs carry the cursor INSIDE the response, as an opaque
 *    @odata.deltaLink URL, rather than as a token you reassemble. So the whole
 *    URL is the cursor.
 *
 * Read-only throughout: Mail.Read and Calendars.Read. The cards promise Kloyya
 * reads and never sends or edits, and the narrowest scope that keeps that promise
 * is the one we ask for.
 */
const AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';
export const MICROSOFT_AUTH_URL = `${AUTHORITY}/authorize`;
export const MICROSOFT_TOKEN_URL = `${AUTHORITY}/token`;
export const GRAPH_API = 'https://graph.microsoft.com/v1.0';

/** offline_access is what makes a refresh token come back; without it the
 *  connection dies in an hour. openid/profile/email identify the account. */
const BASE_SCOPES = ['offline_access', 'openid', 'profile', 'email'];

export const MICROSOFT_SCOPES: Record<string, readonly string[]> = {
  outlook: [...BASE_SCOPES, 'https://graph.microsoft.com/Mail.Read'],
  outlook_calendar: [...BASE_SCOPES, 'https://graph.microsoft.com/Calendars.Read'],
};

export function isMicrosoftIntegration(integrationId: string): boolean {
  return integrationId in MICROSOFT_SCOPES;
}

export function buildMicrosoftAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
  state: string;
}): string {
  const url = new URL(MICROSOFT_AUTH_URL);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', params.scopes.join(' '));
  url.searchParams.set('state', params.state);
  // Force the consent screen so a re-connect reliably re-issues a refresh token,
  // rather than silently reusing a prior grant that may have dropped it.
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

export interface MicrosoftTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  /** The scopes Microsoft actually granted, space-separated in its response. */
  grantedScopes: string[];
}

interface MicrosoftTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

export class MicrosoftAuthRevokedError extends AuthRevokedError {
  constructor(reason: string) {
    super(reason);
    this.name = 'MicrosoftAuthRevokedError';
  }
}

/** Microsoft signals a dead grant with invalid_grant and the AADSTS700082/50173 family. */
function isRevoked(error: string | undefined, description: string | undefined): boolean {
  if (error === 'invalid_grant') return true;
  return /AADSTS(700082|50173|70008|700084)/.test(description ?? '');
}

export async function exchangeMicrosoftCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<MicrosoftTokens> {
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(MICROSOFT_TOKEN_URL, {
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

  const body = (await response.json()) as MicrosoftTokenResponse;
  if (body.error || !body.access_token) {
    // Never echo the body — it can carry the code and the client_secret we sent.
    throw new Error(`Microsoft refused the token exchange: ${body.error ?? 'no access_token'}`);
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000) : null,
    grantedScopes: body.scope ? body.scope.split(' ').filter(Boolean) : [],
  };
}

/**
 * Trade a refresh token for a fresh access token.
 *
 * Microsoft rotates the refresh token on nearly every use, so a null here would
 * be a bug waiting to happen — the new one must be stored, or the next refresh
 * fails. The token manager already persists a returned refreshToken; this just
 * has to return it.
 */
export async function refreshMicrosoftToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): Promise<RefreshedToken> {
  const doFetch = params.fetchImpl ?? fetch;
  const response = await doFetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: params.refreshToken,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: 'refresh_token',
      scope: 'offline_access https://graph.microsoft.com/.default',
    }).toString(),
  });

  const body = (await response.json()) as MicrosoftTokenResponse;
  if (isRevoked(body.error, body.error_description)) {
    throw new MicrosoftAuthRevokedError('Microsoft no longer accepts this connection.');
  }
  if (body.error || !body.access_token) {
    throw new Error(`Microsoft refused the refresh: ${body.error ?? 'no access_token'}`);
  }

  return {
    accessToken: body.access_token,
    expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000) : null,
    refreshToken: body.refresh_token ?? null,
  };
}
