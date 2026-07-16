import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { invitations, memberships, user, users } from '@kloyya/db/schema';
import { ROLES, type Role } from '@kloyya/core';

/** How long an invitation stays usable. Long enough to miss a weekend. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A token the invitee holds and we never store.
 *
 * 32 random bytes, URL-safe. We keep only its SHA-256, so the database contains
 * no usable invitation — the same reason passwords are hashed. No salt or slow
 * KDF here, deliberately: unlike a password this is high-entropy and single-use,
 * so there is nothing for a dictionary attack to guess and no reason to make
 * every lookup expensive.
 */
function mintToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Seniority is ROLES' declaration order; a lower rank is more senior. */
function roleRank(role: Role): number {
  const index = ROLES.indexOf(role);
  return index === -1 ? ROLES.length : index;
}

/**
 * Whether an inviter may grant a role.
 *
 * You cannot invite someone more senior than yourself. Without this, a manager
 * who holds `member:invite` could mint an owner and hand away the organization —
 * the permission to add people is not the permission to promote past yourself.
 * Equal rank is allowed: an owner may appoint a co-owner.
 */
export function mayGrantRole(inviterRole: Role, invitedRole: Role): boolean {
  return roleRank(invitedRole) >= roleRank(inviterRole);
}

export interface InvitationRecord {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
}

export type CreateInvitationResult =
  | { ok: true; invitation: InvitationRecord; token: string }
  | { ok: false; reason: 'forbidden_role' | 'already_a_member' | 'no_profile' };

/**
 * Invite an address into the caller's active workspace.
 *
 * Returns the raw token exactly once, for the email. It is not stored and cannot
 * be recovered — a lost invitation is re-sent, never looked up.
 */
export async function createInvitation(
  db: AppDb,
  inviterId: string,
  input: { email: string; role: Role },
): Promise<CreateInvitationResult> {
  const email = input.email.trim().toLowerCase();

  return db.transaction(async (tx) => {
    const [inviter] = await tx
      .select({
        organizationId: users.organizationId,
        workspaceId: users.activeWorkspaceId,
        role: memberships.role,
      })
      .from(users)
      .innerJoin(
        memberships,
        and(eq(memberships.userId, users.id), eq(memberships.workspaceId, users.activeWorkspaceId)),
      )
      .where(and(eq(users.id, inviterId), isNull(users.deletedAt)))
      .limit(1);

    if (!inviter?.workspaceId) return { ok: false, reason: 'no_profile' } as const;
    if (!mayGrantRole(inviter.role, input.role)) {
      return { ok: false, reason: 'forbidden_role' } as const;
    }

    // Already on this roster? Inviting again is noise, and accepting would be a
    // no-op. The address identifies an identity, so the roster is checked
    // through `user` — the one table that knows emails.
    const [existingMember] = await tx
      .select({ id: memberships.id })
      .from(memberships)
      .innerJoin(user, eq(user.id, memberships.userId))
      .where(and(eq(memberships.workspaceId, inviter.workspaceId), eq(user.email, email)))
      .limit(1);

    if (existingMember) return { ok: false, reason: 'already_a_member' } as const;

    // Supersede any live invitation for the same address in this workspace, so a
    // re-invite replaces rather than accumulates usable tokens.
    await tx
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(invitations.workspaceId, inviter.workspaceId),
          eq(invitations.email, email),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      );

    const { token, tokenHash } = mintToken();
    const [created] = await tx
      .insert(invitations)
      .values({
        organizationId: inviter.organizationId,
        workspaceId: inviter.workspaceId,
        email,
        role: input.role,
        invitedByUserId: inviterId,
        tokenHash,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      })
      .returning({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
      });

    if (!created) return { ok: false, reason: 'no_profile' } as const;

    return {
      ok: true,
      token,
      invitation: {
        id: created.id,
        email: created.email,
        role: created.role,
        expiresAt: created.expiresAt.toISOString(),
        createdAt: created.createdAt.toISOString(),
      },
    } as const;
  });
}

export type AcceptInvitationResult =
  | { ok: true; workspaceId: string; organizationId: string }
  | { ok: false; reason: 'invalid' | 'wrong_recipient' | 'no_profile' };

/**
 * Accept an invitation.
 *
 * The token is looked up by hash, so a stolen database yields nothing usable.
 * Expired, revoked and already-accepted invitations are all rejected as simply
 * `invalid` — which one it was is not the caller's business, and saying so would
 * confirm that a token existed.
 *
 * The session's email must match the invited address. Otherwise a forwarded link
 * would let anyone join in the invitee's place: the invitation names a person,
 * not merely a bearer.
 */
export async function acceptInvitation(
  db: AppDb,
  accepter: { id: string; email: string },
  token: string,
): Promise<AcceptInvitationResult> {
  const tokenHash = hashToken(token);

  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select({
        id: invitations.id,
        organizationId: invitations.organizationId,
        workspaceId: invitations.workspaceId,
        email: invitations.email,
        role: invitations.role,
        expiresAt: invitations.expiresAt,
        acceptedAt: invitations.acceptedAt,
        revokedAt: invitations.revokedAt,
      })
      .from(invitations)
      .where(eq(invitations.tokenHash, tokenHash))
      .limit(1);

    if (
      !invite ||
      invite.acceptedAt !== null ||
      invite.revokedAt !== null ||
      invite.expiresAt.getTime() <= Date.now()
    ) {
      return { ok: false, reason: 'invalid' } as const;
    }

    if (invite.email !== accepter.email.trim().toLowerCase()) {
      return { ok: false, reason: 'wrong_recipient' } as const;
    }

    const [profile] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, accepter.id), isNull(users.deletedAt)))
      .limit(1);
    if (!profile) return { ok: false, reason: 'no_profile' } as const;

    // Idempotent in practice: a second membership in the same workspace is
    // prevented by the (user, workspace) unique index, so re-accepting a
    // superseded token can't duplicate the roster.
    const [already] = await tx
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(eq(memberships.userId, accepter.id), eq(memberships.workspaceId, invite.workspaceId)),
      )
      .limit(1);

    if (!already) {
      await tx.insert(memberships).values({
        organizationId: invite.organizationId,
        workspaceId: invite.workspaceId,
        userId: accepter.id,
        role: invite.role,
      });
    }

    // Land them where they were invited. Their auto-provisioned personal
    // organization still exists; the workspace switcher can return to it.
    await tx
      .update(users)
      .set({ activeWorkspaceId: invite.workspaceId, organizationId: invite.organizationId })
      .where(eq(users.id, accepter.id));

    await tx
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, invite.id));

    return {
      ok: true,
      workspaceId: invite.workspaceId,
      organizationId: invite.organizationId,
    } as const;
  });
}

/** Pending invitations for the caller's active workspace, newest first. */
export async function listPendingInvitations(
  db: AppDb,
  callerId: string,
): Promise<InvitationRecord[]> {
  const [profile] = await db
    .select({ workspaceId: users.activeWorkspaceId })
    .from(users)
    .where(and(eq(users.id, callerId), isNull(users.deletedAt)))
    .limit(1);
  if (!profile?.workspaceId) return [];

  const rows = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.workspaceId, profile.workspaceId),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
      ),
    )
    .orderBy(desc(invitations.createdAt));

  // Expiry is derived, so it's filtered here rather than trusted from a column.
  return rows
    .filter((r) => r.expiresAt.getTime() > Date.now())
    .map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      expiresAt: r.expiresAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }));
}

/**
 * Revoke an invitation.
 *
 * Scoped to the caller's own workspace, so an id from another organization
 * simply isn't found — the same answer as an id that never existed.
 */
export async function revokeInvitation(
  db: AppDb,
  callerId: string,
  invitationId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [profile] = await tx
      .select({ workspaceId: users.activeWorkspaceId })
      .from(users)
      .where(and(eq(users.id, callerId), isNull(users.deletedAt)))
      .limit(1);
    if (!profile?.workspaceId) return false;

    const revoked = await tx
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.workspaceId, profile.workspaceId),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      )
      .returning({ id: invitations.id });

    return revoked.length > 0;
  });
}
