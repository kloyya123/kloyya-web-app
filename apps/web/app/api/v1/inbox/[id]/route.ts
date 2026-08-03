import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEmailThread } from '@server/inbox/service';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { kasRoute } from '@server/http/handler';
import { resolveStartContext } from '@server/tenant';

const idParam = z.string().min(1, 'That is not an email id.');

export const GET = kasRoute('verified', async (_req, ctx) => {
  const id = idParam.parse(ctx.params['id']);
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const thread = await getEmailThread(ctx.db, start, id);
  if (!thread) throw errors.notFound('Email');
  return NextResponse.json(ok(thread, ctx.correlationId));
});
