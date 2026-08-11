import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { getBriefing } from '@server/meetings/service';

const idParam = z.string().min(1, 'That is not a meeting id.');

export const GET = kasRoute('verified', async (_req, ctx) => {
  const id = idParam.parse(ctx.params['id']);
  // getBriefing always throws (see server/meetings/service.ts) — no
  // meeting-intelligence pipeline exists yet. The route still exists so the
  // client gets a proper KAS 404 envelope, the same "none exists yet" shape
  // the mock has always returned for a meeting without one.
  const briefing = await getBriefing(id);
  return NextResponse.json(ok(briefing, ctx.correlationId));
});
