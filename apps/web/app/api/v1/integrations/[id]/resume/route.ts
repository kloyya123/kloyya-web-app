import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { assertPermission } from '@server/auth/permission';
import { resumeConnection } from '@server/integrations/service';
import { lifecycleToApiError } from '@server/integrations/route-helpers';

const idParam = z.string().min(1);

export const POST = kasRoute('verified', async (_req, ctx) => {
  await assertPermission(ctx.db, ctx.identity.id, 'integration:connect');
  const id = idParam.parse(ctx.params['id']);

  const result = await resumeConnection(ctx.db, ctx.identity.id, id);
  if (!result.ok) throw lifecycleToApiError(result, id);
  return NextResponse.json(ok(result.connection, ctx.correlationId));
});
