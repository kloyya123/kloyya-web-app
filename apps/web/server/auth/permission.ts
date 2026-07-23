import { and, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { memberships, users } from '@kloyya/db/schema';
import { can, type Permission } from '@kloyya/core/permissions';
import type { Role } from '@kloyya/core/domain';
import { ApiError, API_STATUS } from '../http/errors';

/**
 * The caller's role in the organization they're acting within, or null if they
 * have no profile or no membership.
 *
 * Reads the role from the ACTIVE workspace's membership — the same one
 * composeUser reports as `user.role`, so what the interface shows a user and
 * what the API enforces are the same fact.
 */
export async function resolveRole(db: AppDb, authUserId: string): Promise<Role | null> {
  const rows = await db
    .select({ role: memberships.role })
    .from(users)
    .innerJoin(
      memberships,
      and(eq(memberships.userId, users.id), eq(memberships.workspaceId, users.activeWorkspaceId)),
    )
    .where(and(eq(users.id, authUserId), isNull(users.deletedAt)))
    .limit(1);

  return rows[0]?.role ?? null;
}

/**
 * Require a permission, not a role, from inside a route handler.
 *
 * Handlers ask "may this caller do X", never "is this caller an owner". The
 * matrix in @kloyya/core answers it, so adding a role or moving a capability is
 * one edit there rather than a hunt through route files — and the UI gates on
 * the same answer.
 *
 * Some authorization depends on the request body, not just the route — patching
 * your own job title and renaming the whole organization arrive at the same
 * endpoint — which is why this is a function to call, not a route-level guard.
 */
export async function assertPermission(
  db: AppDb,
  authUserId: string,
  permission: Permission,
): Promise<void> {
  const role = await resolveRole(db, authUserId);
  if (!role || !can(role, permission)) {
    throw new ApiError({
      httpStatus: API_STATUS.Forbidden,
      errorCode: 'forbidden',
      message: 'You do not have permission to do that.',
      // Names the permission, not the role: telling a caller they need to "be an
      // owner" invites them to ask for the wrong thing.
      description: `This action requires the "${permission}" permission, which your role does not hold.`,
      suggestedResolution: 'Ask an administrator or the workspace owner to do this for you.',
    });
  }
}
