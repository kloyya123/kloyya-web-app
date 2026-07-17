import { describe, expect, it } from 'vitest';
import { buildNotionAuthUrl, exchangeNotionCode, isNotionIntegration, NOTION_VERSION } from './notion.js';
import {
  isNotionRemoval,
  listNotionChanges,
  NotionTransientError,
  NotionUnauthorizedError,
} from './notion-client.js';

const jsonWith = (
  body: unknown,
  status = 200,
  capture?: (init: RequestInit | undefined) => void,
): typeof fetch =>
  (async (_input: string | URL, init?: RequestInit) => {
    capture?.(init);
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;

const raw = (body: string, status: number): typeof fetch =>
  (async () => new Response(body, { status })) as unknown as typeof fetch;

describe('Notion OAuth', () => {
  it('serves only the notion card', () => {
    expect(isNotionIntegration('notion')).toBe(true);
    expect(isNotionIntegration('gmail')).toBe(false);
    expect(isNotionIntegration('outlook')).toBe(false);
  });

  it('builds an owner=user auth url carrying the signed state', () => {
    const url = new URL(
      buildNotionAuthUrl({ clientId: 'client-1', redirectUri: 'http://localhost:4000/cb', state: 'signed' }),
    );
    expect(url.host).toBe('api.notion.com');
    // owner=user is required by Notion — the grant belongs to the approver.
    expect(url.searchParams.get('owner')).toBe('user');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('signed');
  });

  it('exchanges a code with Basic auth and returns a token that never expires', async () => {
    let seen: RequestInit | undefined;
    const tokens = await exchangeNotionCode({
      code: 'c',
      clientId: 'id',
      clientSecret: 'sec',
      redirectUri: 'r',
      fetchImpl: jsonWith({ access_token: 'notion-at', workspace_id: 'ws1' }, 200, (init) => {
        seen = init;
      }),
    });

    // The secret rides in the Authorization header (Basic), not the body.
    const auth = new Headers(seen?.headers).get('authorization') ?? '';
    expect(auth.startsWith('Basic ')).toBe(true);
    expect(Buffer.from(auth.slice(6), 'base64').toString()).toBe('id:sec');
    expect(new Headers(seen?.headers).get('Notion-Version')).toBe(NOTION_VERSION);

    expect(tokens.accessToken).toBe('notion-at');
    // No expiry, no refresh — the two facts the rest of the connector rests on.
    expect(tokens.refreshToken).toBeNull();
    expect(tokens.expiresAt).toBeNull();
    expect(tokens.grantedScopes).toEqual([]);
  });

  it('never echoes the secret or code into an exchange error', async () => {
    const error = await exchangeNotionCode({
      code: 'super-secret-code',
      clientId: 'id',
      clientSecret: 'do-not-leak',
      redirectUri: 'r',
      fetchImpl: jsonWith({ error: 'invalid_grant', error_description: 'nope' }),
    }).catch((e: Error) => e);

    expect(String(error)).not.toContain('do-not-leak');
    expect(String(error)).not.toContain('super-secret-code');
  });
});

describe('Notion search (incremental by high-water mark)', () => {
  it('returns everything on a first sync and reports the newest edit time', async () => {
    const result = await listNotionChanges({
      accessToken: 'at',
      fetchImpl: jsonWith({
        results: [
          { object: 'page', id: 'p1', last_edited_time: '2026-02-03T10:00:00.000Z' },
          { object: 'database', id: 'd1', last_edited_time: '2026-02-01T10:00:00.000Z' },
        ],
        has_more: false,
        next_cursor: null,
      }),
    });

    expect(result.items.map((i) => i.id)).toEqual(['p1', 'd1']);
    // The watermark is the newest last_edited_time seen, not the last item's.
    expect(result.newWatermark).toBe('2026-02-03T10:00:00.000Z');
  });

  it('stops at the high-water mark rather than paging the whole workspace', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      // One page, descending by edit time; the second item predates `since`.
      return new Response(
        JSON.stringify({
          results: [
            { object: 'page', id: 'new', last_edited_time: '2026-02-05T00:00:00.000Z' },
            { object: 'page', id: 'old', last_edited_time: '2026-02-01T00:00:00.000Z' },
          ],
          has_more: true,
          next_cursor: 'more',
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const result = await listNotionChanges({
      accessToken: 'at',
      since: '2026-02-02T00:00:00.000Z',
      fetchImpl,
    });

    // Only the item newer than `since` comes back; 'old' halts the walk.
    expect(result.items.map((i) => i.id)).toEqual(['new']);
    // And we did not fetch the next page, even though has_more was true.
    expect(calls).toBe(1);
    expect(result.newWatermark).toBe('2026-02-05T00:00:00.000Z');
  });

  it('follows pagination until the workspace is exhausted on a first sync', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(
          JSON.stringify({
            results: [{ object: 'page', id: 'p1', last_edited_time: '2026-02-05T00:00:00.000Z' }],
            has_more: true,
            next_cursor: 'cursor-2',
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          results: [{ object: 'page', id: 'p2', last_edited_time: '2026-02-04T00:00:00.000Z' }],
          has_more: false,
          next_cursor: null,
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const result = await listNotionChanges({ accessToken: 'at', fetchImpl });
    expect(result.items.map((i) => i.id)).toEqual(['p1', 'p2']);
    expect(calls).toBe(2);
  });

  it('caps a first sync so an enormous workspace cannot run unbounded', async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          results: Array.from({ length: 100 }, (_v, i) => ({
            object: 'page',
            id: `p${i}`,
            last_edited_time: '2026-02-05T00:00:00.000Z',
          })),
          has_more: true,
          next_cursor: 'always-more',
        }),
        { status: 200 },
      )) as unknown as typeof fetch;

    const result = await listNotionChanges({ accessToken: 'at', maxItems: 150, fetchImpl });
    expect(result.items.length).toBe(150);
  });

  it('maps 401 to unauthorized and 429/5xx to transient', async () => {
    await expect(listNotionChanges({ accessToken: 'at', fetchImpl: raw('no', 401) })).rejects.toBeInstanceOf(
      NotionUnauthorizedError,
    );
    await expect(listNotionChanges({ accessToken: 'at', fetchImpl: raw('slow', 429) })).rejects.toBeInstanceOf(
      NotionTransientError,
    );
    await expect(listNotionChanges({ accessToken: 'at', fetchImpl: raw('down', 503) })).rejects.toBeInstanceOf(
      NotionTransientError,
    );
  });

  it('treats archived or trashed as a removal', () => {
    expect(isNotionRemoval({ object: 'page', id: 'a', archived: true })).toBe(true);
    expect(isNotionRemoval({ object: 'page', id: 'b', in_trash: true })).toBe(true);
    expect(isNotionRemoval({ object: 'page', id: 'c' })).toBe(false);
  });
});
