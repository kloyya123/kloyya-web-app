import type { FastifyInstance } from 'fastify';
import { requireSession } from '../auth/guard.js';
import { ok } from '../http/envelope.js';
import { errors } from '../http/errors.js';

/**
 * The current authenticated identity.
 *
 * This returns the *auth* user (id, email, name, verification) — the identity
 * Better Auth owns. The full domain `User` (organization, role, preferences,
 * onboarding) is composed by joining the profile tables in Phase 5's user
 * service; wiring it here before that service exists would duplicate logic the
 * service is meant to own.
 */
export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/me', { preHandler: requireSession }, async (request) => {
    const ctx = request.auth;
    if (!ctx) throw errors.unauthorized(); // guard guarantees this; satisfies the type

    const { user } = ctx;
    return ok(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        image: user.image ?? null,
      },
      request.correlationId,
    );
  });
}
