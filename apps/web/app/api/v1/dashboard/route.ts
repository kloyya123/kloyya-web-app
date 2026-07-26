import { NextResponse } from 'next/server';
import { getDashboard } from '@server/dashboard/service';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { kasRoute } from '@server/http/handler';
import { resolveStartContext } from '@server/tenant';

/**
 * The dashboard, read from the caller's own workspace.
 *
 * Everything is scoped by the start context resolved from the session — never
 * from a query parameter — and the query runs inside `withTenantScope`, so RLS
 * is the backstop even if the WHERE clause were wrong.
 */
export const GET = kasRoute('verified', async (_req, ctx) => {
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const dashboard = await getDashboard(ctx.db, start);
  return NextResponse.json(ok(dashboard, ctx.correlationId));
});
