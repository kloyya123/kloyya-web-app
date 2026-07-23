import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import {
  DRAFT_STATUSES,
  DRAFT_TYPES,
  deleteDraft,
  getDraft,
  updateDraft,
} from '@server/drafts/service';
import { resolveStartContext } from '@server/tenant';

const idParam = z.string().uuid('That is not a draft id.');

const updateBody = z.object({
  title: z.string().max(300).optional(),
  body: z.string().max(100_000).optional(),
  type: z.enum(DRAFT_TYPES).optional(),
  status: z.enum(DRAFT_STATUSES).optional(),
});

export const GET = kasRoute('verified', async (_req, ctx) => {
  const id = idParam.parse(ctx.params['id']);
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const draft = await getDraft(ctx.db, start, id);
  if (!draft) throw errors.notFound('Draft');
  return NextResponse.json(ok(draft, ctx.correlationId));
});

/** The autosave endpoint — the editor PATCHes as you type (debounced). */
export const PATCH = kasRoute('verified', async (req, ctx) => {
  const id = idParam.parse(ctx.params['id']);
  const patch = updateBody.parse(await req.json());
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const draft = await updateDraft(ctx.db, start, id, patch);
  if (!draft) throw errors.notFound('Draft');
  return NextResponse.json(ok(draft, ctx.correlationId));
});

export const DELETE = kasRoute('verified', async (_req, ctx) => {
  const id = idParam.parse(ctx.params['id']);
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const removed = await deleteDraft(ctx.db, start, id);
  if (!removed) throw errors.notFound('Draft');
  return NextResponse.json(ok({ id, deleted: true }, ctx.correlationId));
});
