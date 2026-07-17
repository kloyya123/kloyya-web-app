import { describe, expect, it } from 'vitest';
import { AuthRevokedError } from './oauth.js';
import {
  buildMicrosoftAuthUrl,
  exchangeMicrosoftCode,
  isMicrosoftIntegration,
  MICROSOFT_SCOPES,
  MicrosoftAuthRevokedError,
  refreshMicrosoftToken,
} from './microsoft.js';
import {
  GraphTransientError,
  listOutlookCalendarDelta,
  listOutlookMailDelta,
  SyncTokenExpiredError,
} from './graph.js';

const json = (body: unknown, status = 200): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

const raw = (body: string, status: number): typeof fetch =>
  (async () => new Response(body, { status })) as unknown as typeof fetch;

describe('Microsoft OAuth', () => {
  it('serves only the two Outlook cards', () => {
    expect(isMicrosoftIntegration('outlook')).toBe(true);
    expect(isMicrosoftIntegration('outlook_calendar')).toBe(true);
    expect(isMicrosoftIntegration('gmail')).toBe(false);
  });

  it('requests offline_access and only read scopes', () => {
    for (const [id, scopes] of Object.entries(MICROSOFT_SCOPES)) {
      // Without offline_access the connection dies in an hour with no refresh.
      expect(scopes, `${id} must request offline_access`).toContain('offline_access');
      const resource = scopes.find((s) => s.includes('graph.microsoft.com/'))!;
      // The cards promise read-only; requesting a write scope would be a lie.
      expect(resource).toMatch(/\.(Read)$/);
    }
  });

  it('builds a common-authority auth url that forces consent', () => {
    const url = new URL(
      buildMicrosoftAuthUrl({
        clientId: 'client-1',
        redirectUri: 'http://localhost:4000/cb',
        scopes: MICROSOFT_SCOPES['outlook']!,
        state: 'signed-state',
      }),
    );

    // `common` lets both work and personal accounts sign in — the app is multi-tenant.
    expect(url.host + url.pathname).toContain('login.microsoftonline.com/common');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('signed-state');
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('exchanges a code for tokens and the scopes granted', async () => {
    const tokens = await exchangeMicrosoftCode({
      code: 'c',
      clientId: 'id',
      clientSecret: 's',
      redirectUri: 'r',
      fetchImpl: json({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600,
        scope: 'https://graph.microsoft.com/Mail.Read',
      }),
    });

    expect(tokens.accessToken).toBe('at');
    expect(tokens.refreshToken).toBe('rt');
    expect(tokens.grantedScopes).toContain('https://graph.microsoft.com/Mail.Read');
  });

  it('never echoes the secret or code into an exchange error', async () => {
    const error = await exchangeMicrosoftCode({
      code: 'super-secret-code',
      clientId: 'id',
      clientSecret: 'do-not-leak',
      redirectUri: 'r',
      fetchImpl: json({ error: 'invalid_client', error_description: 'nope' }),
    }).catch((e: Error) => e);

    expect(String(error)).not.toContain('do-not-leak');
    expect(String(error)).not.toContain('super-secret-code');
  });

  it('refreshes and rotates the refresh token', async () => {
    const refreshed = await refreshMicrosoftToken({
      refreshToken: 'old-rt',
      clientId: 'id',
      clientSecret: 's',
      fetchImpl: json({ access_token: 'new-at', refresh_token: 'new-rt', expires_in: 3600 }),
    });

    expect(refreshed.accessToken).toBe('new-at');
    // Microsoft rotates on nearly every refresh; the new one must be returned to
    // be stored, or the next refresh fails for no visible reason.
    expect(refreshed.refreshToken).toBe('new-rt');
  });

  it('classifies a revoked grant as permanent, an outage as transient', async () => {
    // invalid_grant and the AADSTS700082 family mean re-consent is required.
    await expect(
      refreshMicrosoftToken({
        refreshToken: 'rt',
        clientId: 'id',
        clientSecret: 's',
        fetchImpl: json({ error: 'invalid_grant', error_description: 'AADSTS700082 expired' }),
      }),
    ).rejects.toBeInstanceOf(MicrosoftAuthRevokedError);
    // And it must be catchable through the neutral base the token manager checks.
    await expect(
      refreshMicrosoftToken({
        refreshToken: 'rt',
        clientId: 'id',
        clientSecret: 's',
        fetchImpl: json({ error: 'invalid_grant' }),
      }),
    ).rejects.toBeInstanceOf(AuthRevokedError);

    const transient = await refreshMicrosoftToken({
      refreshToken: 'rt',
      clientId: 'id',
      clientSecret: 's',
      fetchImpl: json({ error: 'temporarily_unavailable' }),
    }).catch((e: Error) => e);
    expect(transient).toBeInstanceOf(Error);
    expect(transient).not.toBeInstanceOf(AuthRevokedError);
  });
});

describe('Graph delta', () => {
  it('walks pages and returns the deltaLink as the cursor', async () => {
    let call = 0;
    const paged = (async () => {
      call += 1;
      if (call === 1) {
        return new Response(
          JSON.stringify({
            value: [{ id: 'm1', subject: 'One' }],
            '@odata.nextLink': 'https://graph.microsoft.com/next',
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          value: [{ id: 'm2', subject: 'Two' }],
          '@odata.deltaLink': 'https://graph.microsoft.com/delta-cursor',
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const result = await listOutlookMailDelta({ accessToken: 'at', fetchImpl: paged });

    expect(result.items.map((i) => i.id)).toEqual(['m1', 'm2']);
    // The cursor is the whole deltaLink URL, captured only from the final page.
    expect(result.nextDeltaLink).toBe('https://graph.microsoft.com/delta-cursor');
  });

  it('separates @removed items as tombstones', async () => {
    const result = await listOutlookMailDelta({
      accessToken: 'at',
      fetchImpl: json({
        value: [
          { id: 'm1', subject: 'Live' },
          { id: 'm2', '@removed': { reason: 'deleted' } },
        ],
        '@odata.deltaLink': 'cursor',
      }),
    });

    expect(result.items.map((i) => i.id)).toEqual(['m1']);
    expect(result.removed).toEqual(['m2']);
  });

  it('treats a 410 as an expired cursor, not a fatal error', async () => {
    await expect(
      listOutlookMailDelta({ accessToken: 'at', deltaLink: 'stale', fetchImpl: raw('gone', 410) }),
    ).rejects.toBeInstanceOf(SyncTokenExpiredError);
  });

  it('treats 429/5xx as transient', async () => {
    await expect(
      listOutlookMailDelta({ accessToken: 'at', fetchImpl: raw('slow', 429) }),
    ).rejects.toBeInstanceOf(GraphTransientError);
  });

  it('scopes a first calendar sync to a date window, then follows the deltaLink', async () => {
    const seen: string[] = [];
    const capturing = (async (input: string | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ value: [], '@odata.deltaLink': 'cal-cursor' }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    await listOutlookCalendarDelta({
      accessToken: 'at',
      windowDays: 90,
      fetchImpl: capturing,
      now: () => Date.parse('2026-02-01T00:00:00Z'),
    });

    // The first request carries the window; the deltaLink carries it thereafter.
    expect(seen[0]).toContain('/calendarView/delta');
    expect(seen[0]).toContain('startDateTime=');
    expect(seen[0]).toContain('endDateTime=');
  });
});
