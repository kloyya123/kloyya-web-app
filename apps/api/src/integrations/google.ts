/**
 * Google OAuth — the scopes, and only the scopes, each card promises.
 *
 * The catalogue tells a user what Kloyya will read and what it will never do.
 * This map is the other half of that promise: the scopes we actually ask Google
 * for. They are all `.readonly`, deliberately — the cards say "Read events" and
 * "never Edit events", and requesting a write scope would make that a lie no
 * matter how well-behaved the code is. The safest way to never edit a user's
 * calendar is to never hold the permission to.
 *
 * KESM: "Every permission must be intentional and documented."
 */
export const GOOGLE_SCOPES: Record<string, readonly string[]> = {
  google_calendar: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events.readonly',
  ],
  gmail: ['https://www.googleapis.com/auth/gmail.readonly'],
  google_drive: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
};

/** Which catalogue ids this provider serves. */
export function isGoogleIntegration(integrationId: string): boolean {
  return integrationId in GOOGLE_SCOPES;
}

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface GoogleAuthUrlParams {
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
  /** Signed, single-use; carries the workspace + integration through the round trip. */
  state: string;
}

export function buildGoogleAuthUrl(params: GoogleAuthUrlParams): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', params.scopes.join(' '));
  url.searchParams.set('state', params.state);
  // offline + consent: without both, Google returns a refresh token only on the
  // FIRST authorization and silently omits it on every re-consent — the classic
  // way a connector works in dev and dies a week later in production when the
  // access token expires and there's nothing to refresh with.
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  return url.toString();
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  /** What Google ACTUALLY granted, which can be less than we asked for. */
  grantedScopes: string[];
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * Exchange an authorization code for tokens.
 *
 * Google reports failures with a 200-shaped body in some flows, so the `error`
 * field is checked rather than only the status — a token exchange that "worked"
 * but returned no access token is a connector that silently does nothing.
 */
export async function exchangeGoogleCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<GoogleTokens> {
  const doFetch = params.fetchImpl ?? fetch;

  const response = await doFetch(GOOGLE_TOKEN_URL, {
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

  const body = (await response.json()) as GoogleTokenResponse;

  if (body.error || !body.access_token) {
    // Never echo the raw body: it can contain the code, and on some errors the
    // client_secret we just sent.
    throw new Error(`Google refused the token exchange: ${body.error ?? 'no access_token returned'}`);
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000) : null,
    // Believe Google's answer, not our own request.
    grantedScopes: body.scope ? body.scope.split(' ').filter(Boolean) : [],
  };
}

/**
 * A refresh failed in a way that will never succeed again.
 *
 * Google answers `invalid_grant` when the user revoked Kloyya in their Google
 * account, changed their password, or the token simply aged out. Retrying that
 * is pointless — the only cure is a human re-consenting. Distinguishing it from
 * a transient failure is the difference between a connection that asks to be
 * reconnected and one that hammers Google forever.
 */
export class GoogleAuthRevokedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'GoogleAuthRevokedError';
  }
}

export interface RefreshedToken {
  accessToken: string;
  expiresAt: Date | null;
  /** Google may rotate the refresh token; null means keep the one we hold. */
  refreshToken: string | null;
}

/**
 * Trade a refresh token for a new access token.
 *
 * Access tokens last about an hour, so this — not the initial handshake — is
 * what a connection actually lives on. Everything after day one depends on it.
 */
export async function refreshGoogleToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): Promise<RefreshedToken> {
  const doFetch = params.fetchImpl ?? fetch;

  const response = await doFetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: params.refreshToken,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: 'refresh_token',
    }).toString(),
  });

  const body = (await response.json()) as GoogleTokenResponse;

  // Permanent: the user took the permission back. Say so, don't retry.
  if (body.error === 'invalid_grant') {
    throw new GoogleAuthRevokedError('Google no longer accepts this connection.');
  }
  if (body.error || !body.access_token) {
    // Transient (5xx, rate limit, network): worth retrying later, so it stays a
    // plain Error and the caller keeps the connection intact.
    throw new Error(`Google refused the refresh: ${body.error ?? 'no access_token returned'}`);
  }

  return {
    accessToken: body.access_token,
    expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000) : null,
    refreshToken: body.refresh_token ?? null,
  };
}
