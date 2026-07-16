import { createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  GoogleAuthRevokedError,
  GOOGLE_SCOPES,
  refreshGoogleToken,
} from './google.js';
import { decodeState, encodeState } from './state.js';

const SECRET = randomBytes(32).toString('base64url');

const base = {
  userId: '11111111-1111-1111-1111-111111111111',
  workspaceId: '22222222-2222-2222-2222-222222222222',
  organizationId: '33333333-3333-3333-3333-333333333333',
  integrationId: 'google_calendar',
};

describe('oauth state', () => {
  it('round-trips what the callback needs', () => {
    const result = decodeState(encodeState(base, SECRET), SECRET);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.userId).toBe(base.userId);
    expect(result.state.workspaceId).toBe(base.workspaceId);
    expect(result.state.integrationId).toBe('google_calendar');
  });

  it('rejects a forged state — the whole point', () => {
    // Without this, a crafted link would graft the attacker's Google account
    // onto the victim's workspace.
    const forged = Buffer.from(
      JSON.stringify({ ...base, workspaceId: 'victims-workspace', issuedAt: Date.now(), nonce: 'x' }),
    ).toString('base64url');

    const result = decodeState(`${forged}.notarealsignature`, SECRET);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('bad_signature');
  });

  it('rejects a state tampered after signing', () => {
    const encoded = encodeState(base, SECRET);
    const [payload, signature] = encoded.split('.') as [string, string];

    const swapped = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    swapped['workspaceId'] = 'somewhere-else';
    const repacked = Buffer.from(JSON.stringify(swapped)).toString('base64url');

    // The old signature cannot cover new content.
    expect(decodeState(`${repacked}.${signature}`, SECRET).ok).toBe(false);
  });

  it('rejects a state signed with another secret', () => {
    const other = randomBytes(32).toString('base64url');
    expect(decodeState(encodeState(base, other), SECRET).ok).toBe(false);
  });

  it('expires — a signature is not a licence forever', () => {
    const [payload] = encodeState(base, SECRET).split('.') as [string];
    const stale = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    // Eleven minutes ago; the TTL is ten.
    stale['issuedAt'] = Date.now() - 11 * 60 * 1000;
    const stalePayload = Buffer.from(JSON.stringify(stale)).toString('base64url');

    // Signed with the REAL secret, so the only thing wrong is its age — an
    // authorization left open in a tab for a week must not still work.
    const signature = createHmac('sha256', SECRET).update(stalePayload).digest('base64url');

    const result = decodeState(`${stalePayload}.${signature}`, SECRET);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('expired');
  });

  it('produces a different state every time', () => {
    expect(encodeState(base, SECRET)).not.toBe(encodeState(base, SECRET));
  });

  it('rejects malformed input rather than throwing', () => {
    expect(decodeState('garbage', SECRET).ok).toBe(false);
    expect(decodeState('a.b.c', SECRET).ok).toBe(false);
  });
});

describe('google authorization url', () => {
  it('asks for offline access and forces consent', () => {
    const url = new URL(
      buildGoogleAuthUrl({
        clientId: 'client-123',
        redirectUri: 'http://localhost:4000/cb',
        scopes: GOOGLE_SCOPES['google_calendar']!,
        state: 'signed-state',
      }),
    );

    // Without BOTH, Google omits the refresh token on re-consent and the
    // connection dies quietly an hour later.
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('signed-state');
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('requests only read-only scopes — the card promises never to edit', () => {
    for (const [integration, scopes] of Object.entries(GOOGLE_SCOPES)) {
      for (const scope of scopes) {
        expect(scope, `${integration} requests a write scope`).toMatch(/readonly$/);
      }
    }
  });
});

describe('google token exchange', () => {
  const okBody = {
    access_token: 'at-1',
    refresh_token: 'rt-1',
    expires_in: 3600,
    scope: GOOGLE_SCOPES['google_calendar']!.join(' '),
  };

  const fetchReturning = (body: unknown, status = 200): typeof fetch =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('returns the tokens and the scopes Google actually granted', async () => {
    const tokens = await exchangeGoogleCode({
      code: 'c',
      clientId: 'id',
      clientSecret: 's',
      redirectUri: 'r',
      fetchImpl: fetchReturning(okBody),
    });

    expect(tokens.accessToken).toBe('at-1');
    expect(tokens.refreshToken).toBe('rt-1');
    expect(tokens.grantedScopes).toEqual(GOOGLE_SCOPES['google_calendar']);
    expect(tokens.expiresAt).toBeInstanceOf(Date);
  });

  it('treats a 200 with an error field as a failure', async () => {
    // Google reports some failures in the body, not the status. Trusting the
    // status alone gives a connector that thinks it worked.
    await expect(
      exchangeGoogleCode({
        code: 'c',
        clientId: 'id',
        clientSecret: 's',
        redirectUri: 'r',
        fetchImpl: fetchReturning({ error: 'invalid_grant' }),
      }),
    ).rejects.toThrow(/invalid_grant/);
  });

  it('fails when no access token comes back', async () => {
    await expect(
      exchangeGoogleCode({
        code: 'c',
        clientId: 'id',
        clientSecret: 's',
        redirectUri: 'r',
        fetchImpl: fetchReturning({ token_type: 'Bearer' }),
      }),
    ).rejects.toThrow(/no access_token/);
  });

  it('distinguishes a revoked grant from a transient failure', async () => {
    // invalid_grant is permanent: the user took the permission back, and only a
    // human re-consenting fixes it. Retrying is pointless; a distinct error type
    // is what stops a connector hammering Google forever.
    await expect(
      refreshGoogleToken({
        refreshToken: 'rt',
        clientId: 'id',
        clientSecret: 's',
        fetchImpl: fetchReturning({ error: 'invalid_grant' }),
      }),
    ).rejects.toBeInstanceOf(GoogleAuthRevokedError);

    // A 5xx is Google's problem, not ours — it stays an ordinary Error so the
    // caller keeps the connection intact and tries again later.
    const transient = await refreshGoogleToken({
      refreshToken: 'rt',
      clientId: 'id',
      clientSecret: 's',
      fetchImpl: fetchReturning({ error: 'backend_error' }),
    }).catch((e: Error) => e);
    expect(transient).toBeInstanceOf(Error);
    expect(transient).not.toBeInstanceOf(GoogleAuthRevokedError);
  });

  it('refreshes into a new access token', async () => {
    const refreshed = await refreshGoogleToken({
      refreshToken: 'rt',
      clientId: 'id',
      clientSecret: 's',
      fetchImpl: fetchReturning({ access_token: 'fresh', expires_in: 3600 }),
    });

    expect(refreshed.accessToken).toBe('fresh');
    expect(refreshed.expiresAt).toBeInstanceOf(Date);
    // null means "keep the one we hold" — Google only sometimes rotates it.
    expect(refreshed.refreshToken).toBeNull();
  });

  it('never echoes the secret or code into the error', async () => {
    const error = await exchangeGoogleCode({
      code: 'super-secret-code',
      clientId: 'id',
      clientSecret: 'GOCSPX-do-not-leak-me',
      redirectUri: 'r',
      fetchImpl: fetchReturning({ error: 'invalid_client', error_description: 'nope' }),
    }).catch((e: Error) => e);

    expect(String(error)).not.toContain('GOCSPX-do-not-leak-me');
    expect(String(error)).not.toContain('super-secret-code');
  });
});
