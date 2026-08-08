import { NextResponse } from 'next/server';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { listNotifications } from '@server/notifications/service';
import { resolveStartContext } from '@server/tenant';

/** Read-only: notifications are written by the server (sync, briefing), never by a client POST. */
export const GET = kasRoute('verified', async (_req, ctx) => {
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const list = await listNotifications(ctx.db, start);
  return NextResponse.json(ok(list, ctx.correlationId));
});
