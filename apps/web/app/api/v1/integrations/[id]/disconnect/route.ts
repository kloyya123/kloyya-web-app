import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { assertPermission } from '@server/auth/permission';
import { disconnectConnection } from '@server/integrations/service';
import { lifecycleToApiError } from '@server/integrations/route-helpers';

const idParam = z.string().min(1);

/** Disconnecting destroys tokens, so it needs the stronger integration:disconnect. */
export const POST = kasRoute('verified', async (_req, ctx) => {
  await assertPermission(ctx.db, ctx.identity.id, 'integration:disconnect');
  const id = idParam.parse(ctx.params['id']);

  const result = await disconnectConnection(ctx.db, ctx.identity.id, id);
  if (!result.ok) throw lifecycleToApiError(result, id);
  return NextResponse.json(ok(result.connection, ctx.correlationId));
});
