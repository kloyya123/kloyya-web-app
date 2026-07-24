import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PRIORITY_LEVELS, TASK_STATUSES } from '@kloyya/core';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { TASK_SORT_FIELDS, createTask, listTasks } from '@server/tasks/service';
import { resolveStartContext } from '@server/tenant';

const statusCsv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',') : []))
  .pipe(z.array(z.enum(TASK_STATUSES)));

const priorityCsv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',') : []))
  .pipe(z.array(z.enum(PRIORITY_LEVELS)));

const listQuery = z.object({
  status: statusCsv,
  priority: priorityCsv,
  projectId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(TASK_SORT_FIELDS).optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  cursor: z.string().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const createBody = z.object({
  title: z.string().min(1).max(300),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITY_LEVELS).optional(),
  ownerId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  dueAt: z.string().datetime().optional(),
});

export const GET = kasRoute('verified', async (req, ctx) => {
  const query = listQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const page = await listTasks(ctx.db, start, query);
  return NextResponse.json(
    ok(page.tasks, ctx.correlationId, {
      pagination: {
        currentCursor: query.cursor ?? null,
        nextCursor: page.nextCursor,
        previousCursor: page.previousCursor,
        pageSize: query.pageSize ?? 20,
        totalCount: page.totalCount,
      },
    }),
  );
});

export const POST = kasRoute('verified', async (req, ctx) => {
  const body = createBody.parse(await req.json());
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');
  return NextResponse.json(ok(await createTask(ctx.db, start, body), ctx.correlationId));
});
