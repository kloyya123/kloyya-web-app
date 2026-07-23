import { NextResponse } from 'next/server';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { composeUser } from '@server/users/service';

/** The current user (the domain `User` DTO). Session guard only. */
export const GET = kasRoute('session', async (_req, ctx) => {
  const user = await composeUser(ctx.db, ctx.identity);
  if (!user) throw errors.notFound('User profile');
  return NextResponse.json(ok(user, ctx.correlationId));
});
