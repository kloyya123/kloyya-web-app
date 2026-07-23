import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { assertPermission } from '@server/auth/permission';
import { getConnection } from '@server/integrations/service';

const idParam = z.string().min(1);

/** One integration's detail. */
export const GET = kasRoute('verified', async (_req, ctx) => {
  await assertPermission(ctx.db, ctx.identity.id, 'workspace:read');
  const id = idParam.parse(ctx.params['id']);

  const connection = await getConnection(ctx.db, ctx.identity.id, id);
  if (!connection) throw errors.notFound('Integration');
  return NextResponse.json(ok(connection, ctx.correlationId));
});
