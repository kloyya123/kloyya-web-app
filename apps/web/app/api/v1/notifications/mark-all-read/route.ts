import { NextResponse } from 'next/server';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { markAllNotificationsRead } from '@server/notifications/service';
import { resolveStartContext } from '@server/tenant';

export const POST = kasRoute('verified', async (_req, ctx) => {
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const changed = await markAllNotificationsRead(ctx.db, start);
  return NextResponse.json(ok({ changed }, ctx.correlationId));
});
