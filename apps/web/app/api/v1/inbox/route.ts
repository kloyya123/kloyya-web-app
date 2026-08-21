import { NextResponse } from 'next/server';
import { getInboxList } from '@server/inbox/service';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { kasRoute } from '@server/http/handler';
import { resolveStartContext } from '@server/tenant';

/**
 * The inbox, read from the caller's own workspace's synced Gmail messages.
 *
 * `services.inbox` was pinned to the mock regardless of NEXT_PUBLIC_USE_REAL_API
 * until this route existed — see server/inbox/service.ts for what "real" means
 * here today and what is still a heuristic.
 */
export const GET = kasRoute('verified', async (_req, ctx) => {
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const inbox = await getInboxList(ctx.db, start);
  return NextResponse.json(ok(inbox, ctx.correlationId));
});
