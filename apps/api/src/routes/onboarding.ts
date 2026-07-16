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
import { completeOnboarding } from '../users/onboarding.js';
import { composeSession } from '../users/service.js';

/**
 * Onboarding.
 *
 * The schema is built from the same constants the frontend's forms use
 * (@kloyya/core), so "what the UI offers" and "what the API accepts" cannot
 * drift apart. A ZodError here becomes the KAS 422 via the shared error handler.
 */
const onboardingSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  jobTitle: z.string().trim().min(1).max(120),
  companyName: z.string().trim().min(1).max(200),
  industry: z.string().trim().min(1).max(120),
  teamSize: z.enum(TEAM_SIZES),
  goals: z.array(z.enum(GOALS)),
  workStyle: z.enum(WORK_STYLES),
  briefingTime: z.enum(BRIEFING_TIMES),
  notificationLevel: z.enum(NOTIFICATION_LEVELS),
});

export async function onboardingRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/onboarding', { preHandler: requireSession }, async (request) => {
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

    const profile = onboardingSchema.parse(request.body);

    const onboarded = await completeOnboarding(db, ctx.user.id, profile);
    if (!onboarded) throw errors.notFound('User profile');

    const session = await composeSession(db, ctx.user.id);
    if (!session) throw errors.notFound('User profile');

    return ok(session, request.correlationId);
  });
}
