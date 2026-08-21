import { NextResponse } from 'next/server';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { listMeetings } from '@server/meetings/service';
import { resolveStartContext } from '@server/tenant';

export const GET = kasRoute('verified', async (_req, ctx) => {
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const meetings = await listMeetings(ctx.db, start);
  return NextResponse.json(ok(meetings, ctx.correlationId));
});
