import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppDb } from '@kloyya/db';
import { memberships, users } from '@kloyya/db/schema';
import { can, type Permission } from '@kloyya/core';
import type { Role } from '@kloyya/core';
import { ApiError, API_STATUS, errors } from '../http/errors.js';

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
 * Require a permission, not a role.
 *
 * Handlers ask "may this caller do X", never "is this caller an owner". The
 * matrix in @kloyya/core answers it, so adding a role or moving a capability is
 * one edit there rather than a hunt through route files — and the UI gates on
 * the same answer.
 *
 * Composes with `requireSession`, which must run first: this reads the session
 * it establishes. A caller who is authenticated but unauthorized gets 403, not
 * 401 — they are known, they simply may not.
 */
export function requirePermission(permission: Permission) {
  return async function guard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const ctx = request.auth;
    if (!ctx) throw errors.unauthorized();
    await assertPermission(requireDb(request), ctx.user.id, permission);
  };
}

/**
 * The same check, callable from inside a handler.
 *
 * Some authorization depends on the request body, not just the route — patching
 * your own job title and renaming the whole organization arrive at the same
 * endpoint. A preHandler cannot see that difference; this can.
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

/** The database, or a 503 that says so plainly. */
export function requireDb(request: FastifyRequest): AppDb {
  const db = request.server.db;
  if (!db) {
    throw new ApiError({
      httpStatus: API_STATUS.ServiceUnavailable,
      errorCode: 'database_unavailable',
      message: 'The database is not configured.',
      description: 'This deployment has no database connection wired up.',
      suggestedResolution: 'Set DATABASE_URL, then restart.',
    });
  }
  return db;
}
