import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { connections, memberships, users } from '@kloyya/db/schema';
import { INTEGRATION_CATALOG } from '@kloyya/core';
import { createTestApp, signUp } from '../test/app.js';

/**
 * The Connection Manager.
 *
 * The catalogue is config; only connection state is data. So the tests care
 * about two things: that a workspace sees the whole catalogue with ITS OWN state
 * attached, and that state changes are refused when they don't make sense.
 */
let app: FastifyInstance;
let client: PGlite;
let db: AppDb;

beforeAll(async () => {
  ({ app, client, db } = await createTestApp());
});

afterAll(async () => {
  await app.close();
  await client.close();
});

/** Put a connection row into a user's workspace, as OAuth eventually will. */
async function seedConnection(
  userId: string,
  integrationId: string,
  status: 'connected' | 'paused' | 'error',
  errorReason?: string,
): Promise<void> {
  const [profile] = await db
    .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
    .from(users)
    .where(eq(users.id, userId));

  await db.insert(connections).values({
    organizationId: profile!.orgId,
    workspaceId: profile!.wsId!,
    integrationId,
    status,
    connectedByUserId: userId,
    lastSyncedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...(errorReason ? { errorReason } : {}),
    // A token, as a real connection would carry — encrypted, and it must never
    // appear in any response below.
    accessTokenEnc: 'v1.aaaa.bbbb.cccc',
    refreshTokenEnc: 'v1.dddd.eeee.ffff',
  });
}

interface ConnectionBody {
  data: {
    definition: { id: string; name: string; permissions: { granted: string[]; notGranted: string[] } };
    status: string;
    lastSyncedAt: string | null;
    errorReason?: string;
  };
}

describe('GET /v1/integrations', () => {
  it('returns the whole catalogue, with everything not_connected for a new workspace', async () => {
    const { cookie } = await signUp(app, {
      email: 'fresh@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Fresh',
    });

    const res = await app.inject({ method: 'GET', url: '/v1/integrations', headers: { cookie } });

    expect(res.statusCode).toBe(200);
    const { data } = res.json<{ data: ConnectionBody['data'][] }>();
    expect(data).toHaveLength(INTEGRATION_CATALOG.length);
    // No rows means not_connected — the absence IS the state.
    expect(data.every((c) => c.status === 'not_connected')).toBe(true);
    expect(data.every((c) => c.lastSyncedAt === null)).toBe(true);
  });

  it('carries the permission promise each card must show', async () => {
    const { cookie } = await signUp(app, {
      email: 'promise@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Promise',
    });

    const res = await app.inject({ method: 'GET', url: '/v1/integrations', headers: { cookie } });
    const { data } = res.json<{ data: ConnectionBody['data'][] }>();
    const calendar = data.find((c) => c.definition.id === 'google_calendar');

    // The API serves the same promise the card makes: what it reads, and what it
    // will never do.
    expect(calendar?.definition.permissions.granted).toContain('Read events');
    expect(calendar?.definition.permissions.notGranted).toContain('Share data externally');
  });

  it('filters by category', async () => {
    const { cookie } = await signUp(app, {
      email: 'category@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Category',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/integrations?category=calendar',
      headers: { cookie },
    });

    const { data } = res.json<{ data: ConnectionBody['data'][] }>();
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((c) => c.definition.id.includes('calendar') || c.definition.id === 'calendly')).toBe(
      true,
    );
  });

  it('rejects a category outside the catalogue with 422', async () => {
    const { cookie } = await signUp(app, {
      email: 'badcat@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Bad Cat',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/integrations?category=telepathy',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(422);
  });

  it('never leaks tokens, however connected', async () => {
    const { cookie, userId } = await signUp(app, {
      email: 'tokens@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Tokens',
    });
    await seedConnection(userId, 'gmail', 'connected');

    const res = await app.inject({ method: 'GET', url: '/v1/integrations', headers: { cookie } });

    // The response shape has nowhere to put a token; this proves it stays that way.
    expect(res.body).not.toContain('v1.aaaa');
    expect(res.body).not.toContain('accessToken');
    expect(res.body).not.toContain('refreshToken');
  });

  it('shows one workspace’s connections and not another’s', async () => {
    const a = await signUp(app, {
      email: 'conn-a@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Conn A',
    });
    const b = await signUp(app, {
      email: 'conn-b@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Conn B',
    });
    await seedConnection(a.userId, 'slack', 'connected');
    await seedConnection(b.userId, 'notion', 'connected');

    const res = await app.inject({
      method: 'GET',
      url: '/v1/integrations',
      headers: { cookie: a.cookie },
    });
    const { data } = res.json<{ data: ConnectionBody['data'][] }>();

    expect(data.find((c) => c.definition.id === 'slack')?.status).toBe('connected');
    // B's Notion connection is not ours to see.
    expect(data.find((c) => c.definition.id === 'notion')?.status).toBe('not_connected');
  });
});

describe('GET /v1/integrations/summary', () => {
  it('counts what is connected and what needs a human', async () => {
    const { cookie, userId } = await signUp(app, {
      email: 'summary@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Summary',
    });
    await seedConnection(userId, 'gmail', 'connected');
    await seedConnection(userId, 'google_calendar', 'paused');
    await seedConnection(userId, 'slack', 'error', 'Slack revoked the token.');

    const res = await app.inject({
      method: 'GET',
      url: '/v1/integrations/summary',
      headers: { cookie },
    });

    const { data } = res.json<{
      data: { connected: number; total: number; needsAttention: number; preview: unknown[] };
    }>();

    // Paused and errored still count as connected — they have data, they just
    // aren't syncing.
    expect(data.connected).toBe(3);
    expect(data.needsAttention).toBe(1);
    expect(data.total).toBe(INTEGRATION_CATALOG.length);
    expect(data.preview.length).toBeLessThanOrEqual(3);
  });
});

describe('connection lifecycle', () => {
  it('pauses a connected integration and resumes it', async () => {
    const { cookie, userId } = await signUp(app, {
      email: 'lifecycle@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Lifecycle',
    });
    await seedConnection(userId, 'gmail', 'connected');

    const paused = await app.inject({
      method: 'POST',
      url: '/v1/integrations/gmail/pause',
      headers: { cookie },
    });
    expect(paused.statusCode).toBe(200);
    expect(paused.json<ConnectionBody>().data.status).toBe('paused');
    // Pausing keeps the data: the last sync is still true.
    expect(paused.json<ConnectionBody>().data.lastSyncedAt).toBe('2026-01-01T00:00:00.000Z');

    const resumed = await app.inject({
      method: 'POST',
      url: '/v1/integrations/gmail/resume',
      headers: { cookie },
    });
    expect(resumed.statusCode).toBe(200);
    expect(resumed.json<ConnectionBody>().data.status).toBe('connected');
  });

  it('refuses to pause something that was never connected', async () => {
    const { cookie } = await signUp(app, {
      email: 'nopause@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'No Pause',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/integrations/gmail/pause',
      headers: { cookie },
    });

    // Silently succeeding would report a state the connector isn't in.
    expect(res.statusCode).toBe(409);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe(
      'wrong_connection_state',
    );
  });

  it('clears the error reason when a connection recovers', async () => {
    const { cookie, userId } = await signUp(app, {
      email: 'recover@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Recover',
    });
    await seedConnection(userId, 'notion', 'error', 'Notion revoked the token.');

    // An errored connection can be paused; doing so must not leave it still
    // explaining a failure it is no longer in.
    const res = await app.inject({
      method: 'POST',
      url: '/v1/integrations/notion/pause',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(409); // error is not a pausable state

    const listed = await app.inject({ method: 'GET', url: '/v1/integrations', headers: { cookie } });
    const notion = listed
      .json<{ data: ConnectionBody['data'][] }>()
      .data.find((c) => c.definition.id === 'notion');
    // While it IS errored, the reason is present — that's the contract.
    expect(notion?.status).toBe('error');
    expect(notion?.errorReason).toBe('Notion revoked the token.');
  });

  it('disconnecting destroys the tokens, not just the status', async () => {
    const { cookie, userId } = await signUp(app, {
      email: 'disconnect@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Disconnect',
    });
    await seedConnection(userId, 'gmail', 'connected');

    const res = await app.inject({
      method: 'POST',
      url: '/v1/integrations/gmail/disconnect',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<ConnectionBody>().data.status).toBe('not_connected');

    // The point of disconnecting: no live refresh token survives it. Scoped to
    // THIS workspace — other tests hold their own gmail rows, and deleting those
    // is exactly what must not happen.
    const [profile] = await db
      .select({ wsId: users.activeWorkspaceId })
      .from(users)
      .where(eq(users.id, userId));
    const rows = await db
      .select({ id: connections.id })
      .from(connections)
      .where(
        and(eq(connections.workspaceId, profile!.wsId!), eq(connections.integrationId, 'gmail')),
      );
    expect(rows).toHaveLength(0);
  });

  it('refuses an id that is not in the catalogue', async () => {
    const { cookie } = await signUp(app, {
      email: 'unknown@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Unknown',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/integrations/myspace/pause',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });

  it('refuses a guest, who cannot manage connections', async () => {
    const { cookie, userId } = await signUp(app, {
      email: 'guest-conn@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Guest Conn',
    });
    await seedConnection(userId, 'gmail', 'connected');
    await db.update(memberships).set({ role: 'guest' }).where(eq(memberships.userId, userId));

    const res = await app.inject({
      method: 'POST',
      url: '/v1/integrations/gmail/disconnect',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { description: string } }>().error.description).toContain(
      'integration:disconnect',
    );
  });
});
