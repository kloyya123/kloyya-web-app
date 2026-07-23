import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ROLES } from '@kloyya/core';
import { kasRoute } from '@server/http/handler';
import { config } from '@server/config';
import { ok } from '@server/http/envelope';
import { API_STATUS, ApiError, errors } from '@server/http/errors';
import { assertPermission } from '@server/auth/permission';
import { invitationEmail } from '@server/email/templates';
import { resolveEmailSender } from '@server/email/resend';
import { createInvitation, listPendingInvitations } from '@server/organization/invitations';
import { getOrgOverview } from '@server/organization/service';

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(ROLES),
});

/** Invite someone into your workspace. */
export const POST = kasRoute('verified', async (req, ctx) => {
  await assertPermission(ctx.db, ctx.identity.id, 'member:invite');
  const input = createSchema.parse(await req.json());

  const result = await createInvitation(ctx.db, ctx.identity.id, input);
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
  const overview = await getOrgOverview(ctx.db, ctx.identity.id);
  const inviter = overview?.members.find((m) => m.id === ctx.identity.id);
  const acceptUrl = `${config.APP_URL}/invite?token=${encodeURIComponent(result.token)}`;

  const message = invitationEmail({
    acceptUrl,
    organizationName: overview?.organization.name ?? 'your team',
    invitedByName: inviter?.fullName ?? ctx.identity.fullName ?? ctx.identity.email,
  });
  await resolveEmailSender().send({ ...message, to: result.invitation.email });

  // The token is deliberately absent from the response: it belongs in the
  // invitee's inbox, not in the inviter's browser.
  return NextResponse.json(ok(result.invitation, ctx.correlationId), { status: 201 });
});

/** Pending invitations for your workspace. */
export const GET = kasRoute('verified', async (_req, ctx) => {
  await assertPermission(ctx.db, ctx.identity.id, 'member:invite');
  const pending = await listPendingInvitations(ctx.db, ctx.identity.id);
  return NextResponse.json(ok(pending, ctx.correlationId));
});
