import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SOURCE_CATEGORIES } from '@kloyya/core/sources';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { listSources } from '@server/sources/service';
import { resolveStartContext } from '@server/tenant';

const listQuery = z.object({
  category: z.enum(SOURCE_CATEGORIES).optional(),
});

export const GET = kasRoute('verified', async (req, ctx) => {
  const { category } = listQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const sources = await listSources(ctx.db, start, category);
  return NextResponse.json(ok(sources, ctx.correlationId));
});
