import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ROLES } from '@kloyya/core';
import { requireSession, requireVerifiedEmail } from '../auth/guard.js';
import { requireDb, requirePermission } from '../auth/permission.js';
import { invitationEmail } from '../email/templates.js';
import { config } from '../config.js';
import { ok } from '../http/envelope.js';
import { ApiError, API_STATUS, errors } from '../http/errors.js';
import {
  acceptInvitation,
  createInvitation,
  listPendingInvitations,
  revokeInvitation,
} from '../organization/invitations.js';
import { composeSession } from '../users/service.js';
import { getOrgOverview } from '../organization/service.js';

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(ROLES),
});

export async function invitationRoutes(app: FastifyInstance): Promise<void> {
  /** Invite someone into your workspace. */
  app.post(
    '/v1/invitations',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('member:invite')] },
    async (request, reply) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const db = requireDb(request);
      const input = createSchema.parse(request.body);

      const result = await createInvitation(db, ctx.user.id, input);

      if (!result.ok) {
        if (result.reason === 'forbidden_role') {
          throw new ApiError({
            httpStatus: API_STATUS.Forbidden,
            errorCode: 'forbidden_role',
            message: 'You cannot invite someone to a role more senior than your own.',
            description: `Granting "${input.role}" is above what your own role allows.`,
            suggestedResolution: 'Invite them at your level or below, or ask an owner.',
          });
        }
        if (result.reason === 'already_a_member') {
          throw new ApiError({
            httpStatus: API_STATUS.Conflict,
            errorCode: 'already_a_member',
            message: 'That person is already in this workspace.',
            description: `${input.email} already has a membership here.`,
            suggestedResolution: 'Change their role instead of inviting them again.',
          });
        }
        throw errors.notFound('User profile');
      }

      // The email names who invited you and where — an invitation from nobody in
      // particular is indistinguishable from phishing.
      const overview = await getOrgOverview(db, ctx.user.id);
      const inviter = overview?.members.find((m) => m.id === ctx.user.id);
      const acceptUrl = `${config.WEB_APP_URL}/invite?token=${encodeURIComponent(result.token)}`;

      const message = invitationEmail({
        acceptUrl,
        organizationName: overview?.organization.name ?? 'your team',
        invitedByName: inviter?.fullName ?? ctx.user.name,
      });
      await request.server.email.send({ ...message, to: result.invitation.email });

      // The token is deliberately absent from the response: it belongs in the
      // invitee's inbox, not in the inviter's browser.
      return reply.status(201).send(ok(result.invitation, request.correlationId));
    },
  );

  /** Pending invitations for your workspace. */
  app.get(
    '/v1/invitations',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('member:invite')] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const pending = await listPendingInvitations(requireDb(request), ctx.user.id);
      return ok(pending, request.correlationId);
    },
  );

  /** Withdraw an invitation that hasn't been accepted. */
  app.post(
    '/v1/invitations/:id/revoke',
    { preHandler: [requireSession, requireVerifiedEmail, requirePermission('member:invite')] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const revoked = await revokeInvitation(requireDb(request), ctx.user.id, id);
      // An invitation from another organization is simply not found — the same
      // answer as one that never existed.
      if (!revoked) throw errors.notFound('Invitation');

      return ok({ id, revoked: true }, request.correlationId);
    },
  );

  /**
   * Accept an invitation.
   *
   * No permission applies — the whole point is that the caller doesn't belong to
   * the organization yet. The token plus a matching address IS the
   * authorization, which is exactly why the address must be PROVEN: sign-up
   * accepts any address without proof, so without requireVerifiedEmail anyone
   * could register as the invitee and redeem their invitation.
   */
  app.post(
    '/v1/invitations/accept',
    { preHandler: [requireSession, requireVerifiedEmail] },
    async (request) => {
    const ctx = request.auth;
    if (!ctx) throw errors.unauthorized();

    const db = requireDb(request);
    const { token } = z.object({ token: z.string().min(1) }).parse(request.body);

    const result = await acceptInvitation(db, { id: ctx.user.id, email: ctx.user.email }, token);

    if (!result.ok) {
      if (result.reason === 'wrong_recipient') {
        throw new ApiError({
          httpStatus: API_STATUS.Forbidden,
          errorCode: 'wrong_recipient',
          message: 'That invitation was sent to a different address.',
          description: 'An invitation names a person; it cannot be redeemed by another account.',
          suggestedResolution: 'Sign in with the address the invitation was sent to.',
        });
      }
      if (result.reason === 'no_profile') throw errors.notFound('User profile');
      // Expired, revoked, already used, or never real — all the same answer, so
      // this endpoint can't be used to discover which tokens exist.
      throw new ApiError({
        httpStatus: API_STATUS.ValidationFailed,
        errorCode: 'invalid_invitation',
        message: 'That invitation is no longer valid.',
        description: 'It may have expired, been withdrawn, or already been used.',
        suggestedResolution: 'Ask for a new invitation.',
      });
    }

    const session = await composeSession(db, ctx.user.id);
    if (!session) throw errors.notFound('User profile');

    return ok(session, request.correlationId);
  });
}
