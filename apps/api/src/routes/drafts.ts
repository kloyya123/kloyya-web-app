import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireSession, requireVerifiedEmail } from '../auth/guard.js';
import { requireDb } from '../auth/permission.js';
import { ok } from '../http/envelope.js';
import { errors } from '../http/errors.js';
import {
  DRAFT_STATUSES,
  DRAFT_TYPES,
  createDraft,
  deleteDraft,
  getDraft,
  listDrafts,
  updateDraft,
} from '../drafts/service.js';
import { resolveStartContext } from '../integrations/connect.js';

/**
 * Drafts.
 *
 * A person's unfinished writing — session-guarded, workspace-scoped. Reading and
 * writing your own drafts needs no special permission beyond being in the
 * workspace, so there is no permission gate here, only the session.
 *
 * PATCH is the autosave endpoint: the editor calls it as you type (debounced),
 * so it is a patch — only the fields you changed move.
 */
const idParams = z.object({ id: z.string().uuid('That is not a draft id.') });

const listQuery = z.object({
  status: z.enum(DRAFT_STATUSES).optional(),
  type: z.enum(DRAFT_TYPES).optional(),
});

const createBody = z.object({
  type: z.enum(DRAFT_TYPES),
  title: z.string().max(300).optional(),
  body: z.string().max(100_000).optional(),
});

const updateBody = z.object({
  title: z.string().max(300).optional(),
  body: z.string().max(100_000).optional(),
  type: z.enum(DRAFT_TYPES).optional(),
  status: z.enum(DRAFT_STATUSES).optional(),
});

export async function draftRoutes(app: FastifyInstance): Promise<void> {
  const guard = { preHandler: [requireSession, requireVerifiedEmail] };

  app.get('/v1/drafts', guard, async (request) => {
    const ctx = request.auth;
    if (!ctx) throw errors.unauthorized();
    const query = listQuery.parse(request.query);

    const db = requireDb(request);
    const start = await resolveStartContext(db, ctx.user.id);
    if (!start) throw errors.notFound('User profile');

    return ok(await listDrafts(db, start, query), request.correlationId);
  });

  app.post('/v1/drafts', guard, async (request) => {
    const ctx = request.auth;
    if (!ctx) throw errors.unauthorized();
    const body = createBody.parse(request.body);

    const db = requireDb(request);
    const start = await resolveStartContext(db, ctx.user.id);
    if (!start) throw errors.notFound('User profile');

    return ok(await createDraft(db, start, body), request.correlationId);
  });

  app.get('/v1/drafts/:id', guard, async (request) => {
    const ctx = request.auth;
    if (!ctx) throw errors.unauthorized();
    const { id } = idParams.parse(request.params);

    const db = requireDb(request);
    const start = await resolveStartContext(db, ctx.user.id);
    if (!start) throw errors.notFound('User profile');

    const draft = await getDraft(db, start, id);
    if (!draft) throw errors.notFound('Draft');
    return ok(draft, request.correlationId);
  });

  app.patch('/v1/drafts/:id', guard, async (request) => {
    const ctx = request.auth;
    if (!ctx) throw errors.unauthorized();
    const { id } = idParams.parse(request.params);
    const patch = updateBody.parse(request.body);

    const db = requireDb(request);
    const start = await resolveStartContext(db, ctx.user.id);
    if (!start) throw errors.notFound('User profile');

    const draft = await updateDraft(db, start, id, patch);
    if (!draft) throw errors.notFound('Draft');
    return ok(draft, request.correlationId);
  });

  app.delete('/v1/drafts/:id', guard, async (request, reply) => {
    const ctx = request.auth;
    if (!ctx) throw errors.unauthorized();
    const { id } = idParams.parse(request.params);

    const db = requireDb(request);
    const start = await resolveStartContext(db, ctx.user.id);
    if (!start) throw errors.notFound('User profile');

    const removed = await deleteDraft(db, start, id);
    if (!removed) throw errors.notFound('Draft');
    return reply.code(204).send();
  });
}
