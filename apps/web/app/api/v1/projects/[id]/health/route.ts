import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { getHealth } from '@server/projects/service';
import { resolveStartContext } from '@server/tenant';

const idParam = z.string().uuid('That is not a project id.');

export const GET = kasRoute('verified', async (_req, ctx) => {
  const id = idParam.parse(ctx.params['id']);
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const health = await getHealth(ctx.db, start, id);
  if (!health) throw errors.notFound('Project');
  return NextResponse.json(ok(health, ctx.correlationId));
});
