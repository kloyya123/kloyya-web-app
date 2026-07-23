import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { assertPermission } from '@server/auth/permission';
import { revokeInvitation } from '@server/organization/invitations';

const idParam = z.string().uuid();

/** Withdraw an invitation that hasn't been accepted. */
export const POST = kasRoute('verified', async (_req, ctx) => {
  await assertPermission(ctx.db, ctx.identity.id, 'member:invite');
  const id = idParam.parse(ctx.params['id']);

  const revoked = await revokeInvitation(ctx.db, ctx.identity.id, id);
  // An invitation from another organization is simply not found — the same
  // answer as one that never existed.
  if (!revoked) throw errors.notFound('Invitation');

  return NextResponse.json(ok({ id, revoked: true }, ctx.correlationId));
});
