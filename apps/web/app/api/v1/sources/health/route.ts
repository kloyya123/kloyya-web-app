import { NextResponse } from 'next/server';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { getHealth } from '@server/sources/service';
import { resolveStartContext } from '@server/tenant';

export const GET = kasRoute('verified', async (_req, ctx) => {
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const health = await getHealth(ctx.db, start);
  return NextResponse.json(ok(health, ctx.correlationId));
});
