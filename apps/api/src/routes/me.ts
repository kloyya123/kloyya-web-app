import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireSession } from '../auth/guard.js';
import { requireDb } from '../auth/permission.js';
import { ok } from '../http/envelope.js';
import { ApiError, API_STATUS, errors } from '../http/errors.js';
import { switchActiveWorkspace } from '../organization/workspace.js';
import { composeSession, composeUser } from '../users/service.js';

/**
 * The current user.
 *
 * Returns the domain `User` from @kloyya/core — the same shape the frontend's
 * mock auth service already returns — composed from the auth identity, the
 * profile, and the active workspace's membership role. Because the shape matches,
 * swapping the frontend from MockAuthService to the real transport is a change
 * of implementation, not of contract.
 */
export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/me', { preHandler: requireSession }, async (request) => {
    const ctx = request.auth;
    if (!ctx) throw errors.unauthorized(); // guard guarantees this; satisfies the type

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

    const user = await composeUser(db, ctx.user.id);
    if (!user) throw errors.notFound('User profile');

    return ok(user, request.correlationId);
  });

  /**
   * Switch the workspace you're working in.
   *
   * No permission guard: switching between workspaces you already belong to is
   * not a privileged act. The authorization that matters is the membership check
   * in switchActiveWorkspace — belonging *is* the permission here.
   */
  app.patch(
    '/v1/me/active-workspace',
    { preHandler: requireSession },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const db = requireDb(request);
      const { workspaceId } = z
        .object({ workspaceId: z.string().uuid() })
        .parse(request.body);

      const switched = await switchActiveWorkspace(db, ctx.user.id, workspaceId);
      if (!switched) {
        throw new ApiError({
          httpStatus: API_STATUS.Forbidden,
          errorCode: 'not_a_member',
          message: 'You are not a member of that workspace.',
          // Deliberately the same answer whether the workspace is someone else's
          // or doesn't exist — the difference is not the caller's business.
          description: 'Kloyya could not find that workspace among the ones you belong to.',
          suggestedResolution: 'Pick a workspace from your switcher, or ask for an invite.',
        });
      }

      const session = await composeSession(db, ctx.user.id);
      if (!session) throw errors.notFound('User profile');

      return ok(session, request.correlationId);
    },
  );
}
