import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { API_STATUS, ApiError, errors } from '@server/http/errors';
import { acceptInvitation } from '@server/organization/invitations';
import { composeSession } from '@server/users/service';

/**
 * Accept an invitation.
 *
 * No permission applies — the whole point is that the caller doesn't belong to
 * the organization yet. The token plus a matching address IS the authorization,
 * which is why the address must be PROVEN ('verified' guard): without it, anyone
 * could sign up as the invitee and redeem their invitation.
 */
export const POST = kasRoute('verified', async (req, ctx) => {
  const { token } = z.object({ token: z.string().min(1) }).parse(await req.json());

  const result = await acceptInvitation(
    ctx.db,
    { id: ctx.identity.id, email: ctx.identity.email },
    token,
  );

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

  const session = await composeSession(ctx.db, ctx.identity);
  if (!session) throw errors.notFound('User profile');
  return NextResponse.json(ok(session, ctx.correlationId));
});
