import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { invitations, memberships } from '@kloyya/db/schema';
import { createTestApp, signUp, type RecordingSender } from '../test/app.js';

/**
 * Invitations.
 *
 * An invitation is a credential, so the tests here are mostly about the ways one
 * could be abused: minting a role above your own, redeeming someone else's link,
 * or replaying one that's been withdrawn.
 */
let app: FastifyInstance;
let client: PGlite;
let db: AppDb;
let email: RecordingSender;

beforeAll(async () => {
  ({ app, client, db, email } = await createTestApp());
});

afterAll(async () => {
  await app.close();
  await client.close();
});

/** The token only ever exists in the email — same as for a real invitee. */
function tokenFromEmailTo(address: string): string {
  const message = email.lastTo(address);
  const match = message?.text.match(/token=([A-Za-z0-9_-]+)/);
  if (!match?.[1]) throw new Error(`no invite token emailed to ${address}`);
  return decodeURIComponent(match[1]);
}

async function owner(emailAddress: string) {
  return signUp(app, {
    email: emailAddress,
    password: 'a sufficiently long passphrase',
    name: 'Org Owner',
  });
}

describe('POST /v1/invitations', () => {
  it('invites someone and emails them a link naming the inviter and org', async () => {
    const inviter = await owner('inviter@kloyya.test');

    const res = await app.inject({
      method: 'POST',
      url: '/v1/invitations',
      headers: { cookie: inviter.cookie, 'content-type': 'application/json' },
      payload: { email: 'Newbie@Kloyya.test', role: 'employee' },
    });

    expect(res.statusCode).toBe(201);
    const { data } = res.json<{ data: { id: string; email: string; role: string } }>();
    // Addresses are stored lowercased so they compare reliably.
    expect(data.email).toBe('newbie@kloyya.test');
    expect(data.role).toBe('employee');
    // The token belongs in the invitee's inbox, not the inviter's browser.
    expect(JSON.stringify(data)).not.toContain('token');

    const message = email.lastTo('newbie@kloyya.test');
    expect(message?.subject).toContain('Org Owner');
    expect(message?.text).toContain('/invite?token=');
  });

  it('stores only a hash of the token — the database holds no usable invitation', async () => {
    const inviter = await owner('hash-check@kloyya.test');
    await app.inject({
      method: 'POST',
      url: '/v1/invitations',
      headers: { cookie: inviter.cookie, 'content-type': 'application/json' },
      payload: { email: 'hashed@kloyya.test', role: 'employee' },
    });

    const token = tokenFromEmailTo('hashed@kloyya.test');
    const rows = await db
      .select({ tokenHash: invitations.tokenHash })
      .from(invitations)
      .where(eq(invitations.email, 'hashed@kloyya.test'));

    expect(rows[0]?.tokenHash).toBeTruthy();
    expect(rows[0]?.tokenHash).not.toBe(token);
    expect(rows[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses to mint a role more senior than the inviter’s own', async () => {
    const boss = await owner('manager-boss@kloyya.test');
    // A manager holds member:invite — but must not be able to create an owner.
    await db.update(memberships).set({ role: 'manager' }).where(eq(memberships.userId, boss.userId));

    const res = await app.inject({
      method: 'POST',
      url: '/v1/invitations',
      headers: { cookie: boss.cookie, 'content-type': 'application/json' },
      payload: { email: 'would-be-owner@kloyya.test', role: 'owner' },
    });

    // The permission to add people is not the permission to promote past yourself.
    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe('forbidden_role');
  });

  it('lets a manager invite at or below their own level', async () => {
    const boss = await owner('manager-ok@kloyya.test');
    await db.update(memberships).set({ role: 'manager' }).where(eq(memberships.userId, boss.userId));

    const res = await app.inject({
      method: 'POST',
      url: '/v1/invitations',
      headers: { cookie: boss.cookie, 'content-type': 'application/json' },
      payload: { email: 'junior@kloyya.test', role: 'employee' },
    });

    expect(res.statusCode).toBe(201);
  });

  it('refuses an employee, who holds no member:invite', async () => {
    const worker = await owner('worker@kloyya.test');
    await db
      .update(memberships)
      .set({ role: 'employee' })
      .where(eq(memberships.userId, worker.userId));

    const res = await app.inject({
      method: 'POST',
      url: '/v1/invitations',
      headers: { cookie: worker.cookie, 'content-type': 'application/json' },
      payload: { email: 'nope@kloyya.test', role: 'employee' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { description: string } }>().error.description).toContain(
      'member:invite',
    );
  });
});

describe('POST /v1/invitations/accept', () => {
  it('adds the invitee to the workspace and lands them in it', async () => {
    const inviter = await owner('host@kloyya.test');
    await app.inject({
      method: 'POST',
      url: '/v1/invitations',
      headers: { cookie: inviter.cookie, 'content-type': 'application/json' },
      payload: { email: 'joiner@kloyya.test', role: 'manager' },
    });
    const token = tokenFromEmailTo('joiner@kloyya.test');

    // The invitee signs up (getting their own personal org), then accepts.
    const joiner = await signUp(app, {
      email: 'joiner@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Joiner',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/invitations/accept',
      headers: { cookie: joiner.cookie, 'content-type': 'application/json' },
      payload: { token },
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json<{
      data: { organization: { name: string }; user: { role: string } };
    }>();
    // They land in the org they were invited to, at the invited role.
    expect(data.organization.name).toBe("Org Owner's Organization");
    expect(data.user.role).toBe('manager');

    // And the host's directory now shows both of them.
    const overview = await app.inject({
      method: 'GET',
      url: '/v1/organization',
      headers: { cookie: inviter.cookie },
    });
    expect(overview.json<{ data: { memberCount: number } }>().data.memberCount).toBe(2);
  });

  it('refuses a link forwarded to a different account', async () => {
    const inviter = await owner('host2@kloyya.test');
    await app.inject({
      method: 'POST',
      url: '/v1/invitations',
      headers: { cookie: inviter.cookie, 'content-type': 'application/json' },
      payload: { email: 'intended@kloyya.test', role: 'employee' },
    });
    const token = tokenFromEmailTo('intended@kloyya.test');

    const interloper = await signUp(app, {
      email: 'interloper@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Interloper',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/invitations/accept',
      headers: { cookie: interloper.cookie, 'content-type': 'application/json' },
      payload: { token },
    });

    // An invitation names a person, not merely a bearer.
    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe('wrong_recipient');
  });

  it('refuses a revoked invitation, and says no more than that', async () => {
    const inviter = await owner('host3@kloyya.test');
    const created = await app.inject({
      method: 'POST',
      url: '/v1/invitations',
      headers: { cookie: inviter.cookie, 'content-type': 'application/json' },
      payload: { email: 'withdrawn@kloyya.test', role: 'employee' },
    });
    const { data } = created.json<{ data: { id: string } }>();
    const token = tokenFromEmailTo('withdrawn@kloyya.test');

    const revoked = await app.inject({
      method: 'POST',
      url: `/v1/invitations/${data.id}/revoke`,
      headers: { cookie: inviter.cookie },
    });
    expect(revoked.statusCode).toBe(200);

    const invitee = await signUp(app, {
      email: 'withdrawn@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Withdrawn',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/invitations/accept',
      headers: { cookie: invitee.cookie, 'content-type': 'application/json' },
      payload: { token },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe('invalid_invitation');
  });

  it('refuses an expired invitation', async () => {
    const inviter = await owner('host4@kloyya.test');
    await app.inject({
      method: 'POST',
      url: '/v1/invitations',
      headers: { cookie: inviter.cookie, 'content-type': 'application/json' },
      payload: { email: 'late@kloyya.test', role: 'employee' },
    });
    const token = tokenFromEmailTo('late@kloyya.test');

    await db
      .update(invitations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invitations.email, 'late@kloyya.test'));

    const invitee = await signUp(app, {
      email: 'late@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Late',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/invitations/accept',
      headers: { cookie: invitee.cookie, 'content-type': 'application/json' },
      payload: { token },
    });

    expect(res.statusCode).toBe(422);
  });

  it('refuses a token that was never real', async () => {
    const nobody = await signUp(app, {
      email: 'nobody@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Nobody',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/invitations/accept',
      headers: { cookie: nobody.cookie, 'content-type': 'application/json' },
      payload: { token: 'totally-made-up' },
    });

    // Same answer as expired/revoked: this endpoint can't be used to discover
    // which tokens exist.
    expect(res.statusCode).toBe(422);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe('invalid_invitation');
  });
});

describe('GET /v1/invitations', () => {
  it('lists only this workspace’s live invitations', async () => {
    const a = await owner('lister-a@kloyya.test');
    const b = await owner('lister-b@kloyya.test');

    await app.inject({
      method: 'POST',
      url: '/v1/invitations',
      headers: { cookie: a.cookie, 'content-type': 'application/json' },
      payload: { email: 'pending-a@kloyya.test', role: 'employee' },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/invitations',
      headers: { cookie: b.cookie, 'content-type': 'application/json' },
      payload: { email: 'pending-b@kloyya.test', role: 'employee' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/invitations',
      headers: { cookie: a.cookie },
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json<{ data: { email: string }[] }>();
    const addresses = data.map((i) => i.email);
    expect(addresses).toContain('pending-a@kloyya.test');
    // Another organization's pending invitations are not ours to see.
    expect(addresses).not.toContain('pending-b@kloyya.test');
  });
});
