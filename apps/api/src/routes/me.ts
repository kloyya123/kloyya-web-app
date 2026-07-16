import type { FastifyInstance } from 'fastify';
import { requireSession } from '../auth/guard.js';
import { ok } from '../http/envelope.js';
import { ApiError, API_STATUS, errors } from '../http/errors.js';
import { composeUser } from '../users/service.js';

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
}
