import { NextResponse } from 'next/server';
import { z } from 'zod';
import { FEEDBACK_CATEGORIES, FEEDBACK_TYPES } from '@kloyya/core/feedback';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { submitFeedback } from '@server/feedback/service';
import { resolveStartContext } from '@server/tenant';

/**
 * Beta feedback — submit a feature request, bug, or note.
 *
 * Session-guarded (it writes on the caller's behalf), workspace-scoped by the
 * service. The body is validated against the same vocabulary the form offers,
 * so the dropdown and the API can't disagree.
 */
const submitBody = z.object({
  type: z.enum(FEEDBACK_TYPES),
  title: z.string().trim().max(160).default(''),
  body: z.string().trim().min(1, 'Say a little about it.').max(4000),
  category: z.enum(FEEDBACK_CATEGORIES).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const POST = kasRoute('verified', async (req, ctx) => {
  const input = submitBody.parse(await req.json());

  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const receipt = await submitFeedback(ctx.db, start, input);
  return NextResponse.json(ok(receipt, ctx.correlationId));
});
