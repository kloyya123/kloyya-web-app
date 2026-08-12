import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { search } from '@server/search/service';
import { resolveStartContext } from '@server/tenant';

const listQuery = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const GET = kasRoute('verified', async (req, ctx) => {
  const query = listQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const results = await search(ctx.db, start, query.q, query.limit);
  return NextResponse.json(ok(results, ctx.correlationId));
});
