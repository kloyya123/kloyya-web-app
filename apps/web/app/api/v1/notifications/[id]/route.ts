import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { markNotificationRead } from '@server/notifications/service';
import { resolveStartContext } from '@server/tenant';

const idParam = z.string().uuid('That is not a notification id.');

export const PATCH = kasRoute('verified', async (_req, ctx) => {
  const id = idParam.parse(ctx.params['id']);
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const notification = await markNotificationRead(ctx.db, start, id);
  if (!notification) throw errors.notFound('Notification');
  return NextResponse.json(ok(notification, ctx.correlationId));
});
