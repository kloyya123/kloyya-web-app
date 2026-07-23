import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { DRAFT_STATUSES, DRAFT_TYPES, createDraft, listDrafts } from '@server/drafts/service';
import { resolveStartContext } from '@server/tenant';

const listQuery = z.object({
  status: z.enum(DRAFT_STATUSES).optional(),
  type: z.enum(DRAFT_TYPES).optional(),
});

const createBody = z.object({
  type: z.enum(DRAFT_TYPES),
  title: z.string().max(300).optional(),
  body: z.string().max(100_000).optional(),
});

export const GET = kasRoute('verified', async (req, ctx) => {
  const query = listQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');
  return NextResponse.json(ok(await listDrafts(ctx.db, start, query), ctx.correlationId));
});

export const POST = kasRoute('verified', async (req, ctx) => {
  const body = createBody.parse(await req.json());
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');
  return NextResponse.json(ok(await createDraft(ctx.db, start, body), ctx.correlationId));
});
