import { and, eq, ne } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import type { Tx } from '@kloyya/db/scope';
import { memberships, users } from '@kloyya/db/schema';
import type { Role } from '@kloyya/core';
import { mayGrantRole } from './invitations.js';

/**
 * Managing the people already in a workspace.
 *
 * Three rules run through everything here, and they are the reason this file
 * isn't just two UPDATE statements:
 *
 *  1. You cannot act on someone more senior than you. `member:role:update` lets a
 *     manager manage the team; it must not let them demote the owner and take
 *     the company. Seniority is checked against the TARGET's current role, not
 *     only the new one.
 *  2. You cannot promote past yourself — the same rule invitations enforce.
 *  3. An organization must keep an owner. The last one cannot be demoted or
 *     removed, or the org becomes unadministrable by anyone, forever.
 */
export type MemberChangeResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'not_found' | 'target_is_senior' | 'forbidden_role' | 'last_owner' | 'no_profile';
    };

interface Actor {
  workspaceId: string;
  organizationId: string;
  role: Role;
}

async function resolveActor(tx: Tx, actorId: string): Promise<Actor | null> {
  const [row] = await tx
    .select({
      workspaceId: users.activeWorkspaceId,
      organizationId: users.organizationId,
      role: memberships.role,
    })
    .from(users)
    .innerJoin(
      memberships,
      and(eq(memberships.userId, users.id), eq(memberships.workspaceId, users.activeWorkspaceId)),
    )
    .where(eq(users.id, actorId))
    .limit(1);

  if (!row?.workspaceId) return null;
  return { workspaceId: row.workspaceId, organizationId: row.organizationId, role: row.role };
}

/** Whether this workspace would still have an owner without `targetId`'s. */
async function wouldLeaveNoOwner(
  tx: Tx,
  workspaceId: string,
  targetId: string,
  targetRole: Role,
): Promise<boolean> {
  if (targetRole !== 'owner') return false;

  const otherOwners = await tx
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        eq(memberships.role, 'owner'),
        ne(memberships.userId, targetId),
      ),
    )
    .limit(1);

  return otherOwners.length === 0;
}

export async function changeMemberRole(
  db: AppDb,
  actorId: string,
  targetId: string,
  newRole: Role,
): Promise<MemberChangeResult> {
  return db.transaction(async (tx) => {
    const actor = await resolveActor(tx, actorId);
    if (!actor) return { ok: false, reason: 'no_profile' } as const;

    const [target] = await tx
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, targetId), eq(memberships.workspaceId, actor.workspaceId)))
      .limit(1);

    // Someone in another organization is simply not here.
    if (!target) return { ok: false, reason: 'not_found' } as const;

    if (!mayGrantRole(actor.role, target.role)) {
      return { ok: false, reason: 'target_is_senior' } as const;
    }
    if (!mayGrantRole(actor.role, newRole)) {
      return { ok: false, reason: 'forbidden_role' } as const;
    }
    if (newRole !== 'owner' && (await wouldLeaveNoOwner(tx, actor.workspaceId, targetId, target.role))) {
      return { ok: false, reason: 'last_owner' } as const;
    }

    await tx
      .update(memberships)
      .set({ role: newRole })
      .where(and(eq(memberships.userId, targetId), eq(memberships.workspaceId, actor.workspaceId)));

    return { ok: true } as const;
  });
}

export async function removeMember(
  db: AppDb,
  actorId: string,
  targetId: string,
): Promise<MemberChangeResult> {
  return db.transaction(async (tx) => {
    const actor = await resolveActor(tx, actorId);
    if (!actor) return { ok: false, reason: 'no_profile' } as const;

    const [target] = await tx
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, targetId), eq(memberships.workspaceId, actor.workspaceId)))
      .limit(1);

    if (!target) return { ok: false, reason: 'not_found' } as const;
    if (!mayGrantRole(actor.role, target.role)) {
      return { ok: false, reason: 'target_is_senior' } as const;
    }
    if (await wouldLeaveNoOwner(tx, actor.workspaceId, targetId, target.role)) {
      return { ok: false, reason: 'last_owner' } as const;
    }

    await tx
      .delete(memberships)
      .where(and(eq(memberships.userId, targetId), eq(memberships.workspaceId, actor.workspaceId)));

    // Their profile still points at the workspace they were just removed from.
    // Leaving it there would have every scoped read run against an organization
    // they no longer belong to — they'd be locked out (no membership means no
    // role means no permission), but pointing a live profile at a former
    // employer is a fact waiting to be relied on. Move them to a workspace they
    // do still belong to; sign-up gave everyone their own, so there is normally
    // one to fall back to.
    const [elsewhere] = await tx
      .select({
        workspaceId: memberships.workspaceId,
        organizationId: memberships.organizationId,
      })
      .from(memberships)
      .where(eq(memberships.userId, targetId))
      .limit(1);

    if (elsewhere) {
      await tx
        .update(users)
        .set({
          activeWorkspaceId: elsewhere.workspaceId,
          organizationId: elsewhere.organizationId,
        })
        .where(
          and(eq(users.id, targetId), eq(users.activeWorkspaceId, actor.workspaceId)),
        );
    }

    return { ok: true } as const;
  });
}
