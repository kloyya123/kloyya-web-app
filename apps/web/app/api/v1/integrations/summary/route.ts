import { NextResponse } from 'next/server';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { assertPermission } from '@server/auth/permission';
import { getSummary } from '@server/integrations/service';

/** The dashboard's "N of M connected" summary. */
export const GET = kasRoute('verified', async (_req, ctx) => {
  await assertPermission(ctx.db, ctx.identity.id, 'workspace:read');
  const summary = await getSummary(ctx.db, ctx.identity.id);
  if (!summary) throw errors.notFound('User profile');
  return NextResponse.json(ok(summary, ctx.correlationId));
});
