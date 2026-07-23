import { NextResponse } from 'next/server';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { assertPermission } from '@server/auth/permission';
import { getOrgOverview } from '@server/organization/service';

/**
 * The organization overview. `member:read` is the permission that matters — a
 * guest was invited to a workspace, not handed the company directory.
 */
export const GET = kasRoute('verified', async (_req, ctx) => {
  await assertPermission(ctx.db, ctx.identity.id, 'member:read');

  const overview = await getOrgOverview(ctx.db, ctx.identity.id);
  if (!overview) throw errors.notFound('Organization');
  return NextResponse.json(ok(overview, ctx.correlationId));
});
