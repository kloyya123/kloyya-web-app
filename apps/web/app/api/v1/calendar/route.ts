import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { getSchedule } from '@server/calendar/service';
import { resolveStartContext } from '@server/tenant';

const listQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  view: z.enum(['day', 'week']),
});

export const GET = kasRoute('verified', async (req, ctx) => {
  const query = listQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const schedule = await getSchedule(ctx.db, start, query);
  return NextResponse.json(ok(schedule, ctx.correlationId));
});
