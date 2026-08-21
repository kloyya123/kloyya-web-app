import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { connections, syncRecords } from '@kloyya/db/schema';
import { withTenantScope } from '@kloyya/db/scope';
import { actAs, createTestDb, createTestIdentity, resetDeps, startContextFor } from '@server/test/harness';
import { config } from '@server/config';
import { isGenuineSlackRequest, landLiveMessage, POST } from './route';

/**
 * Two things this route lives or dies on: the signature check is the entire
 * authentication story (there is no session), and the team-id lookup is the
 * only thing standing between an incoming event and the right tenant's data.
 */
describe('isGenuineSlackRequest', () => {
  const secret = 'test-signing-secret';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const rawBody = JSON.stringify({ type: 'event_callback' });

  function sign(ts: string, body: string, key: string): string {
    return `v0=${createHmac('sha256', key).update(`v0:${ts}:${body}`).digest('hex')}`;
  }

  it('accepts a correctly signed, recent request', () => {
    expect(
      isGenuineSlackRequest({
        signingSecret: secret,
        timestampHeader: timestamp,
        signatureHeader: sign(timestamp, rawBody, secret),
        rawBody,
      }),
    ).toBe(true);
  });

  it('refuses a signature computed with the wrong secret', () => {
    expect(
      isGenuineSlackRequest({
        signingSecret: secret,
        timestampHeader: timestamp,
        signatureHeader: sign(timestamp, rawBody, 'wrong-secret'),
        rawBody,
      }),
    ).toBe(false);
  });

  it('refuses a signature computed over a different body', () => {
    expect(
      isGenuineSlackRequest({
        signingSecret: secret,
        timestampHeader: timestamp,
        signatureHeader: sign(timestamp, rawBody, secret),
        rawBody: JSON.stringify({ type: 'tampered' }),
      }),
    ).toBe(false);
  });

  it('refuses a stale timestamp, even with a correct signature — a replay', () => {
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 6 * 60);
    expect(
      isGenuineSlackRequest({
        signingSecret: secret,
        timestampHeader: oldTimestamp,
        signatureHeader: sign(oldTimestamp, rawBody, secret),
        rawBody,
      }),
    ).toBe(false);
  });

  it('refuses a request missing either header', () => {
    expect(
      isGenuineSlackRequest({ signingSecret: secret, timestampHeader: null, signatureHeader: 'v0=x', rawBody }),
    ).toBe(false);
    expect(
      isGenuineSlackRequest({ signingSecret: secret, timestampHeader: timestamp, signatureHeader: null, rawBody }),
    ).toBe(false);
  });
});

describe('landLiveMessage', () => {
  let client: PGlite;
  let db: AppDb;

  beforeAll(async () => {
    ({ db, client } = await createTestDb());
    actAs(db, null);
  });

  afterAll(async () => {
    resetDeps();
    await client.close();
  });

  async function connectSlack(teamId: string) {
    const identity = await createTestIdentity(db, { email: `slack-events-${teamId}@kloyya.test` });
    const ctx = await startContextFor(db, identity);
    await withTenantScope(db, ctx.organizationId, async (tx) => {
      await tx.insert(connections).values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        integrationId: 'slack',
        status: 'connected',
        connectedByUserId: ctx.userId,
        accessTokenEnc: null,
        syncCursors: { 'slack:team_id': teamId },
      });
    });
    return ctx;
  }

  it('lands a live message onto the workspace whose team id matches', async () => {
    const ctx = await connectSlack('T111');

    await landLiveMessage('T111', { type: 'message', channel: 'C1', user: 'U1', text: 'Ship it', ts: '1722675000.0001' });

    const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
      tx.select().from(syncRecords).where(eq(syncRecords.resourceType, 'slack_message')),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.externalId).toBe('C1:1722675000.0001');
  });

  it('lands nothing for a team id no connection has', async () => {
    await connectSlack('T222');

    // Should not throw, and should not touch any workspace's data.
    await expect(
      landLiveMessage('T-unknown', { type: 'message', channel: 'C9', ts: '1722675999.0001' }),
    ).resolves.toBeUndefined();
  });

  it('skips a system subtype, same as the scheduled sync does', async () => {
    const ctx = await connectSlack('T333');

    await landLiveMessage('T333', {
      type: 'message',
      subtype: 'channel_join',
      channel: 'C1',
      user: 'U2',
      ts: '1722675001.0001',
    });

    const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
      tx.select().from(syncRecords).where(eq(syncRecords.resourceType, 'slack_message')),
    );
    expect(rows).toEqual([]);
  });
});

describe('POST /api/v1/integrations/slack/events', () => {
  function sign(ts: string, body: string): string {
    return `v0=${createHmac('sha256', config.SLACK_SIGNING_SECRET!).update(`v0:${ts}:${body}`).digest('hex')}`;
  }

  function request(body: unknown): NextRequest {
    const raw = JSON.stringify(body);
    const ts = String(Math.floor(Date.now() / 1000));
    return new NextRequest('http://test.local/api/v1/integrations/slack/events', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-slack-request-timestamp': ts,
        'x-slack-signature': sign(ts, raw),
      },
      body: raw,
    });
  }

  // These exercise the real route with a real signature, computed from
  // whatever SLACK_SIGNING_SECRET is actually configured — never a value
  // hardcoded in this file. Skipped if the environment has none configured,
  // the same "unconfigured is not broken" distinction the route itself makes.
  const itIfConfigured = config.SLACK_SIGNING_SECRET ? it : it.skip;

  itIfConfigured('answers the URL verification handshake', async () => {
    const response = await POST(request({ type: 'url_verification', challenge: 'abc123' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ challenge: 'abc123' });
  });

  itIfConfigured('acknowledges an event type it does not act on, without erroring', async () => {
    const response = await POST(
      request({ type: 'event_callback', team_id: 'T1', event: { type: 'reaction_added' } }),
    );
    expect(response.status).toBe(200);
  });

  itIfConfigured('refuses a request with no signature at all', async () => {
    const raw = JSON.stringify({ type: 'url_verification', challenge: 'x' });
    const response = await POST(
      new NextRequest('http://test.local/api/v1/integrations/slack/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: raw,
      }),
    );
    expect(response.status).toBe(401);
  });
});
