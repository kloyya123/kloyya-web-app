import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  BRIEFING_TIMES,
  GOALS,
  NOTIFICATION_LEVELS,
  TEAM_SIZES,
  WORK_STYLES,
} from '@kloyya/core';
import { requireSession } from '../auth/guard.js';
import { ok } from '../http/envelope.js';
import { ApiError, API_STATUS, errors } from '../http/errors.js';
import { updateSettings } from '../users/onboarding.js';
import { composeSession } from '../users/service.js';

/**
 * Settings.
 *
 * A patch: every field optional, and an absent field means "leave it alone" —
 * not "clear it". The enum members come from the same @kloyya/core constants the
 * Settings form renders, so the UI can't offer a value the API would reject.
 */
const settingsSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  companyName: z.string().trim().min(1).max(200).optional(),
  industry: z.string().trim().min(1).max(120).optional(),
  preferences: z
    .object({
      teamSize: z.enum(TEAM_SIZES).optional(),
      goals: z.array(z.enum(GOALS)).optional(),
      workStyle: z.enum(WORK_STYLES).optional(),
      briefingTime: z.enum(BRIEFING_TIMES).optional(),
      notificationLevel: z.enum(NOTIFICATION_LEVELS).optional(),
    })
    .optional(),
});

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.patch('/v1/settings', { preHandler: requireSession }, async (request) => {
    const ctx = request.auth;
    if (!ctx) throw errors.unauthorized();

    const db = request.server.db;
    if (!db) {
      throw new ApiError({
        httpStatus: API_STATUS.ServiceUnavailable,
        errorCode: 'database_unavailable',
        message: 'The database is not configured.',
        description: 'This deployment has no database connection wired up.',
        suggestedResolution: 'Set DATABASE_URL, then restart.',
      });
    }

    const patch = settingsSchema.parse(request.body ?? {});

    const updated = await updateSettings(db, ctx.user.id, patch);
    if (!updated) throw errors.notFound('User profile');

    const session = await composeSession(db, ctx.user.id);
    if (!session) throw errors.notFound('User profile');

    return ok(session, request.correlationId);
  });
}
