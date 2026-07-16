import { and, eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { memberships, users } from '@kloyya/db/schema';

/**
 * Switch the workspace the caller currently has open.
 *
 * The membership check is the whole point, not a formality. `activeWorkspaceId`
 * is what composeUser reads to decide which organization and role a caller has —
 * so accepting an arbitrary workspace id here would let anyone adopt another
 * tenant's workspace and, through it, that tenant's organization. Membership is
 * verified against (user, workspace) before anything is written; an unaffiliated
 * id is refused, never stored.
 *
 * Returns false when the caller holds no membership in that workspace — which
 * covers both "it isn't yours" and "it doesn't exist", deliberately: telling a
 * stranger which workspace ids are real is an enumeration oracle.
 */
export async function switchActiveWorkspace(
  db: AppDb,
  authUserId: string,
  workspaceId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ workspaceId: memberships.workspaceId, organizationId: memberships.organizationId })
      .from(memberships)
      .where(and(eq(memberships.userId, authUserId), eq(memberships.workspaceId, workspaceId)))
      .limit(1);

    if (!membership) return false;

    // organizationId moves with the workspace: a member of two organizations who
    // switches workspace has switched organization too, and leaving the profile's
    // org pointing at the old one would make every scoped read disagree with the
    // workspace on screen.
    await tx
      .update(users)
      .set({ activeWorkspaceId: membership.workspaceId, organizationId: membership.organizationId })
      .where(eq(users.id, authUserId));

    return true;
  });
}
