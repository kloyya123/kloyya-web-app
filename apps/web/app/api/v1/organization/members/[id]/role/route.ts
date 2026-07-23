import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ROLES } from '@kloyya/core';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { assertPermission } from '@server/auth/permission';
import { changeMemberRole } from '@server/organization/members';
import { getOrgOverview } from '@server/organization/service';
import { memberChangeToApiError } from '@server/organization/member-errors';

const idParam = z.string().uuid();

/** Change a member's role. Permission-gated, then per-target rules in the service. */
export const PATCH = kasRoute('verified', async (req, ctx) => {
  await assertPermission(ctx.db, ctx.identity.id, 'member:role:update');
  const userId = idParam.parse(ctx.params['id']);
  const { role } = z.object({ role: z.enum(ROLES) }).parse(await req.json());

  const result = await changeMemberRole(ctx.db, ctx.identity.id, userId, role);
  if (!result.ok) throw memberChangeToApiError(result);

  const overview = await getOrgOverview(ctx.db, ctx.identity.id);
  if (!overview) throw errors.notFound('Organization');
  return NextResponse.json(ok(overview, ctx.correlationId));
});
