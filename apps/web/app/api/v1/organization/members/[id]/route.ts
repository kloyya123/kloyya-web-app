import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { assertPermission } from '@server/auth/permission';
import { removeMember } from '@server/organization/members';
import { getOrgOverview } from '@server/organization/service';
import { memberChangeToApiError } from '@server/organization/member-errors';

const idParam = z.string().uuid();

/**
 * Remove a member. Gated twice: the permission matrix decides whether you may
 * manage members at all, and the service decides whether you may manage THIS
 * member — seniority and the last-owner rule are per-target facts.
 */
export const DELETE = kasRoute('verified', async (_req, ctx) => {
  await assertPermission(ctx.db, ctx.identity.id, 'member:remove');
  const userId = idParam.parse(ctx.params['id']);

  const result = await removeMember(ctx.db, ctx.identity.id, userId);
  if (!result.ok) throw memberChangeToApiError(result);

  const overview = await getOrgOverview(ctx.db, ctx.identity.id);
  if (!overview) throw errors.notFound('Organization');
  return NextResponse.json(ok(overview, ctx.correlationId));
});
