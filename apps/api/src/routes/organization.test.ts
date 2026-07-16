import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { memberships, users, workspaces } from '@kloyya/db/schema';
import { createTestApp, signUp } from '../test/app.js';

/**
 * The organization directory and workspace switching.
 *
 * The tests that matter here are the ones about *other people's* organizations:
 * a directory must never span tenants, and `activeWorkspaceId` must never become
 * a way to adopt one.
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

interface OverviewBody {
  data: {
    organization: { id: string; name: string; plan: string };
    workspace: { id: string; name: string };
    members: { id: string; email: string; fullName: string; role: string }[];
    memberCount: number;
  };
}

describe('GET /v1/organization', () => {
  it('returns the caller’s organization, workspace and members', async () => {
    const { cookie } = await signUp(app, {
      email: 'solo@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Solo Founder',
    });

    const res = await app.inject({ method: 'GET', url: '/v1/organization', headers: { cookie } });

    expect(res.statusCode).toBe(200);
    const { data } = res.json<OverviewBody>();
    expect(data.organization.name).toBe("Solo Founder's Organization");
    expect(data.workspace.name).toBe('General');
    expect(data.memberCount).toBe(1);
    expect(data.members[0]?.email).toBe('solo@kloyya.test');
    expect(data.members[0]?.role).toBe('owner');
  });

  it('lists members most senior first', async () => {
    const founder = await signUp(app, {
      email: 'boss@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Boss Person',
    });
    const [profile] = await db
      .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
      .from(users)
      .where(eq(users.id, founder.userId));

    // Two colleagues in the same workspace, added junior-first on purpose.
    for (const [email, name, role] of [
      ['zed@kloyya.test', 'Zed Junior', 'employee'],
      ['mid@kloyya.test', 'Mid Manager', 'manager'],
    ] as const) {
      const colleague = await signUp(app, {
        email,
        password: 'a sufficiently long passphrase',
        name,
      });
      // Move them into the founder's org/workspace.
      await db
        .update(users)
        .set({ organizationId: profile!.orgId, activeWorkspaceId: profile!.wsId })
        .where(eq(users.id, colleague.userId));
      await db
        .update(memberships)
        .set({ organizationId: profile!.orgId, workspaceId: profile!.wsId!, role })
        .where(eq(memberships.userId, colleague.userId));
    }

    const res = await app.inject({
      method: 'GET',
      url: '/v1/organization',
      headers: { cookie: founder.cookie },
    });

    const { data } = res.json<OverviewBody>();
    expect(data.memberCount).toBe(3);
    expect(data.members.map((m) => m.role)).toEqual(['owner', 'manager', 'employee']);
  });

  it('never spans tenants — one organization cannot see another', async () => {
    const a = await signUp(app, {
      email: 'tenant-a@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Tenant A',
    });
    await signUp(app, {
      email: 'tenant-b@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Tenant B',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/organization',
      headers: { cookie: a.cookie },
    });

    const { data } = res.json<OverviewBody>();
    expect(data.organization.name).toBe("Tenant A's Organization");
    expect(data.members.map((m) => m.email)).toEqual(['tenant-a@kloyya.test']);
    expect(data.members.map((m) => m.email)).not.toContain('tenant-b@kloyya.test');
  });

  it('refuses a guest the company directory', async () => {
    const { cookie, userId } = await signUp(app, {
      email: 'guest@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Guest Person',
    });
    await db.update(memberships).set({ role: 'guest' }).where(eq(memberships.userId, userId));

    const res = await app.inject({ method: 'GET', url: '/v1/organization', headers: { cookie } });

    // A guest was invited to a workspace, not handed the company directory.
    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { errorCode: string; description: string } }>().error.description).toContain(
      'member:read',
    );
  });

  it('requires a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/organization' });
    expect(res.statusCode).toBe(401);
  });
});

describe('PATCH /v1/me/active-workspace', () => {
  it('refuses to switch into another tenant’s workspace', async () => {
    const attacker = await signUp(app, {
      email: 'attacker@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Attacker',
    });
    const victim = await signUp(app, {
      email: 'victim@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Victim',
    });

    const [victimProfile] = await db
      .select({ wsId: users.activeWorkspaceId, orgId: users.organizationId })
      .from(users)
      .where(eq(users.id, victim.userId));

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me/active-workspace',
      headers: { cookie: attacker.cookie, 'content-type': 'application/json' },
      payload: { workspaceId: victimProfile!.wsId },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe('not_a_member');

    // The attacker's own org is untouched — no adoption by side effect.
    const me = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { cookie: attacker.cookie },
    });
    expect(me.json<{ data: { organizationId: string } }>().data.organizationId).not.toBe(
      victimProfile!.orgId,
    );
  });

  it('switches to a workspace the caller belongs to', async () => {
    const member = await signUp(app, {
      email: 'switcher@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Switcher',
    });
    const [profile] = await db
      .select({ orgId: users.organizationId })
      .from(users)
      .where(eq(users.id, member.userId));

    // A second workspace in their own organization, with a membership.
    const [second] = await db
      .insert(workspaces)
      .values({ organizationId: profile!.orgId, name: 'Skunkworks' })
      .returning({ id: workspaces.id });
    await db.insert(memberships).values({
      organizationId: profile!.orgId,
      workspaceId: second!.id,
      userId: member.userId,
      role: 'team_lead',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me/active-workspace',
      headers: { cookie: member.cookie, 'content-type': 'application/json' },
      payload: { workspaceId: second!.id },
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json<{ data: { workspace: { name: string }; user: { role: string } } }>();
    expect(data.workspace.name).toBe('Skunkworks');
    // Role travels with the workspace — it's the membership's role, not the user's.
    expect(data.user.role).toBe('team_lead');
  });

  it('rejects a malformed workspace id with 422', async () => {
    const { cookie } = await signUp(app, {
      email: 'malformed@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Malformed',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me/active-workspace',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { workspaceId: 'not-a-uuid' },
    });

    expect(res.statusCode).toBe(422);
  });
});
