import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FEEDBACK_CATEGORIES, FEEDBACK_TYPES } from '@kloyya/core';
import { requireSession, requireVerifiedEmail } from '../auth/guard.js';
import { requireDb } from '../auth/permission.js';
import { ok } from '../http/envelope.js';
import { errors } from '../http/errors.js';
import { feedbackSummary, submitFeedback } from '../feedback/service.js';
import { resolveStartContext } from '../integrations/connect.js';

/**
 * Beta feedback.
 *
 * Submit a feature request, bug, or note; read the running tallies. Session-
 * guarded (it writes on the caller's behalf), workspace-scoped by the service.
 * The body is validated against the same vocabulary the form offers, so the
 * dropdown and the API can't disagree.
 */
const submitBody = z.object({
  type: z.enum(FEEDBACK_TYPES),
  title: z.string().trim().max(160).default(''),
  body: z.string().trim().min(1, 'Say a little about it.').max(4000),
  category: z.enum(FEEDBACK_CATEGORIES).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export async function feedbackRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/v1/feedback',
    { preHandler: [requireSession, requireVerifiedEmail] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const input = submitBody.parse(request.body);

      const db = requireDb(request);
      const start = await resolveStartContext(db, ctx.user.id);
      if (!start) throw errors.notFound('User profile');

      const receipt = await submitFeedback(db, start, input);
      return ok(receipt, request.correlationId);
    },
  );

  app.get(
    '/v1/feedback/summary',
    { preHandler: [requireSession, requireVerifiedEmail] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const db = requireDb(request);
      const start = await resolveStartContext(db, ctx.user.id);
      if (!start) throw errors.notFound('User profile');

      return ok(await feedbackSummary(db, start), request.correlationId);
    },
  );
}
