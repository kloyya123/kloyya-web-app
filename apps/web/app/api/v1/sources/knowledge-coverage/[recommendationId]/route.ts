import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { getCoverage } from '@server/sources/service';

const idParam = z.string().min(1, 'That is not a recommendation id.');

export const GET = kasRoute('verified', async (_req, ctx) => {
  const id = idParam.parse(ctx.params['recommendationId']);
  // Always throws (see server/sources/service.ts) — no recommendation
  // pipeline exists yet.
  const coverage = await getCoverage(id);
  return NextResponse.json(ok(coverage, ctx.correlationId));
});
