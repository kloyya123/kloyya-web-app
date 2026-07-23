import { NextResponse } from 'next/server';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { feedbackSummary } from '@server/feedback/service';
import { resolveStartContext } from '@server/tenant';

/** The running feedback tallies for the beta-status panel. */
export const GET = kasRoute('verified', async (_req, ctx) => {
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  return NextResponse.json(ok(await feedbackSummary(ctx.db, start), ctx.correlationId));
});
