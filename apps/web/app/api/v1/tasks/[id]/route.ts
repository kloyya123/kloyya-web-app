import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TASK_STATUSES } from '@kloyya/core';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { deleteTask, getTask, updateTaskStatus } from '@server/tasks/service';
import { resolveStartContext } from '@server/tenant';

const idParam = z.string().uuid('That is not a task id.');

const updateBody = z.object({
  status: z.enum(TASK_STATUSES),
});

export const GET = kasRoute('verified', async (_req, ctx) => {
  const id = idParam.parse(ctx.params['id']);
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const task = await getTask(ctx.db, start, id);
  if (!task) throw errors.notFound('Task');
  return NextResponse.json(ok(task, ctx.correlationId));
});

export const PATCH = kasRoute('verified', async (req, ctx) => {
  const id = idParam.parse(ctx.params['id']);
  const { status } = updateBody.parse(await req.json());
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const task = await updateTaskStatus(ctx.db, start, id, status);
  if (!task) throw errors.notFound('Task');
  return NextResponse.json(ok(task, ctx.correlationId));
});

export const DELETE = kasRoute('verified', async (_req, ctx) => {
  const id = idParam.parse(ctx.params['id']);
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const removed = await deleteTask(ctx.db, start, id);
  if (!removed) throw errors.notFound('Task');
  return NextResponse.json(ok({ id, deleted: true }, ctx.correlationId));
});
