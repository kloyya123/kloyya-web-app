import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { getMeeting } from '@server/meetings/service';
import { resolveStartContext } from '@server/tenant';

const idParam = z.string().min(1, 'That is not a meeting id.');

export const GET = kasRoute('verified', async (_req, ctx) => {
  const id = idParam.parse(ctx.params['id']);
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const meeting = await getMeeting(ctx.db, start, id);
  if (!meeting) throw errors.notFound('Meeting');
  return NextResponse.json(ok(meeting, ctx.correlationId));
});
