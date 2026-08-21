import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { deletePushSubscription, upsertPushSubscription } from '@server/notifications/push-subscriptions';
import { resolveStartContext } from '@server/tenant';

const subscribeBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().max(500).optional(),
});

const unsubscribeBody = z.object({ endpoint: z.string().url() });

/** Called right after the browser's `PushManager.subscribe()` resolves. */
export const POST = kasRoute('verified', async (req, ctx) => {
  const body = subscribeBody.parse(await req.json());
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  await upsertPushSubscription(ctx.db, start, {
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    userAgent: body.userAgent,
  });
  return NextResponse.json(ok({ subscribed: true }, ctx.correlationId));
});

/** Called when the user turns desktop notifications off. */
export const DELETE = kasRoute('verified', async (req, ctx) => {
  const body = unsubscribeBody.parse(await req.json());
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  await deletePushSubscription(ctx.db, start, body.endpoint);
  return NextResponse.json(ok({ subscribed: false }, ctx.correlationId));
});
