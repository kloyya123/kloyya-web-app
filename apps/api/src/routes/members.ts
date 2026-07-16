import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ROLES } from '@kloyya/core';
import { requireSession, requireVerifiedEmail } from '../auth/guard.js';
import { requireDb, requirePermission } from '../auth/permission.js';
import { ok } from '../http/envelope.js';
import { ApiError, API_STATUS, errors } from '../http/errors.js';
import { changeMemberRole, removeMember, type MemberChangeResult } from '../organization/members.js';
import { getOrgOverview } from '../organization/service.js';

const paramsSchema = z.object({ userId: z.string().uuid() });

/** Turn a refusal into the KAS error that explains it. */
function toApiError(result: Extract<MemberChangeResult, { ok: false }>): ApiError {
  switch (result.reason) {
    case 'target_is_senior':
      return new ApiError({
        httpStatus: API_STATUS.Forbidden,
        errorCode: 'target_is_senior',
        message: 'You cannot manage someone more senior than you.',
        description: 'That person holds a role above your own.',
        suggestedResolution: 'Ask an owner or administrator to make this change.',
      });
    case 'forbidden_role':
      return new ApiError({
        httpStatus: API_STATUS.Forbidden,
        errorCode: 'forbidden_role',
        message: 'You cannot grant a role more senior than your own.',
        description: 'Promoting someone past yourself is not permitted.',
        suggestedResolution: 'Choose a role at or below your own level.',
      });
    case 'last_owner':
      return new ApiError({
        httpStatus: API_STATUS.Conflict,
        errorCode: 'last_owner',
        message: 'An organization must keep an owner.',
        description: 'This is the only owner; removing or demoting them would leave nobody able to administer the organization.',
        suggestedResolution: 'Make someone else an owner first, then try again.',
      });
    case 'not_found':
      return errors.notFound('Member');
    case 'no_profile':
      return errors.notFound('User profile');
  }
}

/**
 * Member management.
 *
 * Both routes are gated twice over: the permission matrix decides whether you may
 * manage members at all, and the service decides whether you may manage THIS
 * member — seniority and the last-owner rule are per-target facts a preHandler
 * cannot see.
 */
export async function memberRoutes(app: FastifyInstance): Promise<void> {
  app.patch(
    '/v1/organization/members/:userId/role',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('member:role:update')] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const db = requireDb(request);
      const { userId } = paramsSchema.parse(request.params);
      const { role } = z.object({ role: z.enum(ROLES) }).parse(request.body);

      const result = await changeMemberRole(db, ctx.user.id, userId, role);
      if (!result.ok) throw toApiError(result);

      const overview = await getOrgOverview(db, ctx.user.id);
      if (!overview) throw errors.notFound('Organization');
      return ok(overview, request.correlationId);
    },
  );

  app.delete(
    '/v1/organization/members/:userId',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('member:remove')] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const db = requireDb(request);
      const { userId } = paramsSchema.parse(request.params);

      const result = await removeMember(db, ctx.user.id, userId);
      if (!result.ok) throw toApiError(result);

      const overview = await getOrgOverview(db, ctx.user.id);
      if (!overview) throw errors.notFound('Organization');
      return ok(overview, request.correlationId);
    },
  );
}
