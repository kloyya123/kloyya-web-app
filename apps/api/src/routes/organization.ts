import type { FastifyInstance } from 'fastify';
import { requireSession, requireVerifiedEmail } from '../auth/guard.js';
import { requireDb, requirePermission } from '../auth/permission.js';
import { ok } from '../http/envelope.js';
import { errors } from '../http/errors.js';
import { getOrgOverview } from '../organization/service.js';

/**
 * The organization.
 *
 * `member:read` is the permission that matters here — a guest was invited to a
 * workspace, not handed the company directory, and the matrix already says so.
 */
export async function organizationRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/v1/organization',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('member:read')] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const overview = await getOrgOverview(requireDb(request), ctx.user.id);
      if (!overview) throw errors.notFound('Organization');

      return ok(overview, request.correlationId);
    },
  );
}
