import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PROJECT_STATUSES } from '@kloyya/core';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { createProject, listProjects } from '@server/projects/service';
import { resolveStartContext } from '@server/tenant';

const createBody = z.object({
  name: z.string().min(1).max(300),
  status: z.enum(PROJECT_STATUSES).optional(),
  ownerId: z.string().uuid().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  riskScore: z.number().int().min(0).max(100).optional(),
  healthScore: z.number().int().min(0).max(100).optional(),
  deadline: z.string().datetime().optional(),
});

export const GET = kasRoute('verified', async (_req, ctx) => {
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');
  const projects = await listProjects(ctx.db, start);
  return NextResponse.json(ok({ projects }, ctx.correlationId));
});

export const POST = kasRoute('verified', async (req, ctx) => {
  const body = createBody.parse(await req.json());
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');
  return NextResponse.json(ok(await createProject(ctx.db, start, body), ctx.correlationId));
});
