import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { INTEGRATION_CATEGORIES } from '@kloyya/core';
import { requireSession, requireVerifiedEmail } from '../auth/guard.js';
import { requireDb, requirePermission } from '../auth/permission.js';
import { ok } from '../http/envelope.js';
import { ApiError, API_STATUS, errors } from '../http/errors.js';
import {
  disconnectConnection,
  getConnection,
  getSummary,
  listConnections,
  pauseConnection,
  resumeConnection,
  type LifecycleResult,
} from '../integrations/service.js';

/**
 * The Connection Manager, matching the frontend's IntegrationsService.
 *
 * Reading is `workspace:read` (every role in a workspace can see which tools it
 * runs on); changing a connection is `integration:connect`, and disconnecting —
 * which destroys tokens — is `integration:disconnect`.
 *
 * connect / reconnect / forceSync are deliberately absent. connect and reconnect
 * are the OAuth handshake, which needs Google credentials; forceSync needs the
 * sync engine. A forceSync that only touched lastSyncedAt would tell a user
 * their data is fresh when nothing moved, which is worse than a missing button.
 */
const idParams = z.object({ id: z.string().min(1) });
const listQuery = z.object({ category: z.enum(INTEGRATION_CATEGORIES).optional() });

function toApiError(result: Extract<LifecycleResult, { ok: false }>, id: string): ApiError {
  switch (result.reason) {
    case 'unknown_integration':
      return errors.notFound('Integration');
    case 'no_profile':
      return errors.notFound('User profile');
    case 'wrong_state':
      return new ApiError({
        httpStatus: API_STATUS.Conflict,
        errorCode: 'wrong_connection_state',
        message: 'That integration is not in a state where this makes sense.',
        description: `${id} is currently "${result.current ?? 'unknown'}".`,
        suggestedResolution: 'Refresh the page to see its real state, then try again.',
      });
  }
}

export async function integrationRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/v1/integrations',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('workspace:read')] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const { category } = listQuery.parse(request.query);
      const list = await listConnections(requireDb(request), ctx.user.id, category);
      if (!list) throw errors.notFound('User profile');

      return ok(list, request.correlationId);
    },
  );

  app.get(
    '/v1/integrations/summary',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('workspace:read')] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const summary = await getSummary(requireDb(request), ctx.user.id);
      if (!summary) throw errors.notFound('User profile');

      return ok(summary, request.correlationId);
    },
  );

  app.get(
    '/v1/integrations/:id',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('workspace:read')] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const { id } = idParams.parse(request.params);
      const connection = await getConnection(requireDb(request), ctx.user.id, id);
      if (!connection) throw errors.notFound('Integration');

      return ok(connection, request.correlationId);
    },
  );

  app.post(
    '/v1/integrations/:id/pause',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('integration:connect')] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const { id } = idParams.parse(request.params);
      const result = await pauseConnection(requireDb(request), ctx.user.id, id);
      if (!result.ok) throw toApiError(result, id);

      return ok(result.connection, request.correlationId);
    },
  );

  app.post(
    '/v1/integrations/:id/resume',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('integration:connect')] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const { id } = idParams.parse(request.params);
      const result = await resumeConnection(requireDb(request), ctx.user.id, id);
      if (!result.ok) throw toApiError(result, id);

      return ok(result.connection, request.correlationId);
    },
  );

  app.post(
    '/v1/integrations/:id/disconnect',
    {
      preHandler: [
        requireSession,
        requireVerifiedEmail,
        requirePermission('integration:disconnect'),
      ],
    },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const { id } = idParams.parse(request.params);
      const result = await disconnectConnection(requireDb(request), ctx.user.id, id);
      if (!result.ok) throw toApiError(result, id);

      return ok(result.connection, request.correlationId);
    },
  );
}
