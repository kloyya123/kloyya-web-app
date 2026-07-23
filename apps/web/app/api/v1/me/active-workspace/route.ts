import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { API_STATUS, ApiError, errors } from '@server/http/errors';
import { switchActiveWorkspace } from '@server/organization/workspace';
import { composeSession } from '@server/users/service';

/**
 * Switch the workspace you're working in.
 *
 * No permission guard: switching between workspaces you already belong to is not
 * a privileged act. The membership check inside switchActiveWorkspace is the
 * authorization — belonging *is* the permission here.
 */
export const PATCH = kasRoute('session', async (req, ctx) => {
  const { workspaceId } = z.object({ workspaceId: z.string().uuid() }).parse(await req.json());

  const switched = await switchActiveWorkspace(ctx.db, ctx.identity.id, workspaceId);
  if (!switched) {
    throw new ApiError({
      httpStatus: API_STATUS.Forbidden,
      errorCode: 'not_a_member',
      message: 'You are not a member of that workspace.',
      description: 'Kloyya could not find that workspace among the ones you belong to.',
      suggestedResolution: 'Pick a workspace from your switcher, or ask for an invite.',
    });
  }

  const session = await composeSession(ctx.db, ctx.identity);
  if (!session) throw errors.notFound('User profile');
  return NextResponse.json(ok(session, ctx.correlationId));
});
