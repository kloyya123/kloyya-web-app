import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { getSourceUsage } from '@server/sources/service';

const idParam = z.string().min(1, 'That is not a recommendation id.');

export const GET = kasRoute('verified', async (_req, ctx) => {
  const id = idParam.parse(ctx.params['recommendationId']);
  // Always throws (see server/sources/service.ts) — no recommendation
  // pipeline exists yet. The route still exists so the client gets a real
  // KAS 404 envelope for a surface it already renders.
  const usage = await getSourceUsage(id);
  return NextResponse.json(ok(usage, ctx.correlationId));
});
