import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { memberships, users } from '@kloyya/db/schema';
import type { Role } from '@kloyya/core';
import { createTestApp, signUp } from '../test/app.js';

/**
 * Member management.
 *
 * The interesting cases are the ones where a legitimate permission would, on its
 * own, be enough to take the organization: a manager demoting the owner, anyone
 * promoting themselves, or the last owner disappearing.
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

/** An owner plus a colleague in the same workspace, at the given roles. */
async function team(
  prefix: string,
  ownerRole: Role,
  colleagueRole: Role,
): Promise<{ ownerCookie: string; ownerId: string; colleagueId: string; workspaceId: string }> {
  const boss = await signUp(app, {
    email: `${prefix}-boss@kloyya.test`,
    password: 'a sufficiently long passphrase',
    name: 'Boss',
  });
  const [profile] = await db
    .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
    .from(users)
    .where(eq(users.id, boss.userId));

  const colleague = await signUp(app, {
    email: `${prefix}-colleague@kloyya.test`,
    password: 'a sufficiently long passphrase',
    name: 'Colleague',
  });
  // Mirror what accepting an invitation actually does: KEEP the personal
  // membership sign-up created, ADD one in the host's workspace, and switch to
  // it. Mutating the personal membership instead would leave them with nowhere
  // to fall back to — a setup that quietly tests a situation that can't occur.
  await db.insert(memberships).values({
    organizationId: profile!.orgId,
    workspaceId: profile!.wsId!,
    userId: colleague.userId,
    role: colleagueRole,
  });
  await db
    .update(users)
    .set({ organizationId: profile!.orgId, activeWorkspaceId: profile!.wsId })
    .where(eq(users.id, colleague.userId));

  if (ownerRole !== 'owner') {
    await db.update(memberships).set({ role: ownerRole }).where(eq(memberships.userId, boss.userId));
  }

  return {
    ownerCookie: boss.cookie,
    ownerId: boss.userId,
    colleagueId: colleague.userId,
    workspaceId: profile!.wsId!,
  };
}

async function roleOf(userId: string, workspaceId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspaceId)));
  return row?.role;
}

describe('PATCH /v1/organization/members/:userId/role', () => {
  it('lets an owner promote a colleague', async () => {
    const t = await team('promote', 'owner', 'employee');

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/organization/members/${t.colleagueId}/role`,
      headers: { cookie: t.ownerCookie, 'content-type': 'application/json' },
      payload: { role: 'manager' },
    });

    expect(res.statusCode).toBe(200);
    expect(await roleOf(t.colleagueId, t.workspaceId)).toBe('manager');
  });

  it('refuses to let a manager demote the owner', async () => {
    // The manager legitimately holds member:role:update. That must not be enough
    // to take the company.
    const t = await team('coup', 'owner', 'manager');
    const manager = await signUp(app, {
      email: 'coup-manager@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Ambitious',
    });
    const [profile] = await db
      .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
      .from(users)
      .where(eq(users.id, t.ownerId));
    await db
      .update(users)
      .set({ organizationId: profile!.orgId, activeWorkspaceId: profile!.wsId })
      .where(eq(users.id, manager.userId));
    await db
      .update(memberships)
      .set({ organizationId: profile!.orgId, workspaceId: profile!.wsId!, role: 'administrator' })
      .where(eq(memberships.userId, manager.userId));

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/organization/members/${t.ownerId}/role`,
      headers: { cookie: manager.cookie, 'content-type': 'application/json' },
      payload: { role: 'employee' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe('target_is_senior');
    // The owner is still the owner.
    expect(await roleOf(t.ownerId, t.workspaceId)).toBe('owner');
  });

  it('refuses to let an administrator promote anyone to owner', async () => {
    const t = await team('escalate', 'administrator', 'employee');

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/organization/members/${t.colleagueId}/role`,
      headers: { cookie: t.ownerCookie, 'content-type': 'application/json' },
      payload: { role: 'owner' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe('forbidden_role');
    expect(await roleOf(t.colleagueId, t.workspaceId)).toBe('employee');
  });

  it('refuses to demote the last owner', async () => {
    const t = await team('lastowner', 'owner', 'employee');

    // The owner demoting themselves would leave the org unadministrable forever.
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/organization/members/${t.ownerId}/role`,
      headers: { cookie: t.ownerCookie, 'content-type': 'application/json' },
      payload: { role: 'employee' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe('last_owner');
    expect(await roleOf(t.ownerId, t.workspaceId)).toBe('owner');
  });

  it('allows demoting an owner once another owner exists', async () => {
    const t = await team('coowner', 'owner', 'employee');

    await app.inject({
      method: 'PATCH',
      url: `/v1/organization/members/${t.colleagueId}/role`,
      headers: { cookie: t.ownerCookie, 'content-type': 'application/json' },
      payload: { role: 'owner' },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/organization/members/${t.ownerId}/role`,
      headers: { cookie: t.ownerCookie, 'content-type': 'application/json' },
      payload: { role: 'administrator' },
    });

    expect(res.statusCode).toBe(200);
    expect(await roleOf(t.ownerId, t.workspaceId)).toBe('administrator');
  });

  it('refuses someone in another organization — they are simply not here', async () => {
    const t = await team('stranger', 'owner', 'employee');
    const outsider = await signUp(app, {
      email: 'stranger-outsider@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Outsider',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/organization/members/${outsider.userId}/role`,
      headers: { cookie: t.ownerCookie, 'content-type': 'application/json' },
      payload: { role: 'employee' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('refuses an employee, who holds no member:role:update', async () => {
    const t = await team('norights', 'employee', 'employee');

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/organization/members/${t.colleagueId}/role`,
      headers: { cookie: t.ownerCookie, 'content-type': 'application/json' },
      payload: { role: 'manager' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { description: string } }>().error.description).toContain(
      'member:role:update',
    );
  });
});

describe('DELETE /v1/organization/members/:userId', () => {
  it('removes a member and returns the updated directory', async () => {
    const t = await team('remove', 'owner', 'employee');

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/organization/members/${t.colleagueId}`,
      headers: { cookie: t.ownerCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: { memberCount: number } }>().data.memberCount).toBe(1);
    expect(await roleOf(t.colleagueId, t.workspaceId)).toBeUndefined();
  });

  it('moves the removed member off the workspace they no longer belong to', async () => {
    const t = await team('reassign', 'owner', 'employee');

    await app.inject({
      method: 'DELETE',
      url: `/v1/organization/members/${t.colleagueId}`,
      headers: { cookie: t.ownerCookie },
    });

    // Their profile must not still point at a former employer's workspace.
    const [profile] = await db
      .select({ wsId: users.activeWorkspaceId, orgId: users.organizationId })
      .from(users)
      .where(eq(users.id, t.colleagueId));
    expect(profile?.wsId).not.toBe(t.workspaceId);
    // They fall back to the personal organization sign-up gave them.
    expect(profile?.wsId).toBeTruthy();
  });

  it('refuses to remove the last owner', async () => {
    const t = await team('lastowner-del', 'owner', 'employee');

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/organization/members/${t.ownerId}`,
      headers: { cookie: t.ownerCookie },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe('last_owner');
    expect(await roleOf(t.ownerId, t.workspaceId)).toBe('owner');
  });

  it('refuses to let a junior remove someone senior', async () => {
    const t = await team('junior', 'owner', 'manager');

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/organization/members/${t.ownerId}`,
      headers: { cookie: t.ownerCookie },
    });
    // Sanity: the owner can act. The refusal below is what matters.
    expect(res.statusCode).toBe(409); // last owner, not seniority

    const colleague = await signUp(app, {
      email: 'junior-second@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Second',
    });
    const [profile] = await db
      .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
      .from(users)
      .where(eq(users.id, t.ownerId));
    await db
      .update(users)
      .set({ organizationId: profile!.orgId, activeWorkspaceId: profile!.wsId })
      .where(eq(users.id, colleague.userId));
    await db
      .update(memberships)
      .set({ organizationId: profile!.orgId, workspaceId: profile!.wsId!, role: 'administrator' })
      .where(eq(memberships.userId, colleague.userId));

    const attempt = await app.inject({
      method: 'DELETE',
      url: `/v1/organization/members/${t.ownerId}`,
      headers: { cookie: colleague.cookie },
    });

    expect(attempt.statusCode).toBe(403);
    expect(attempt.json<{ error: { errorCode: string } }>().error.errorCode).toBe(
      'target_is_senior',
    );
  });
});
