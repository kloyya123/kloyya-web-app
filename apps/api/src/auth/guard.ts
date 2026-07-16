import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiError, API_STATUS, errors } from '../http/errors.js';
import type { Auth } from './auth.js';

/**
 * The authenticated context a guarded request carries: exactly what Better Auth
 * resolves from the session, so the type tracks the library rather than a
 * hand-maintained duplicate.
 */
export type SessionContext = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>;

/**
 * A Fastify preHandler that requires a valid session. On success it attaches the
 * resolved `{ user, session }` to `request.auth` for the route to use; otherwise
 * it throws the KAS 401 (or 503 if auth isn't configured on this instance).
 *
 * Reads the session from the request cookies via Better Auth — no token parsing
 * here, the library owns that.
 */
export async function requireSession(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const auth = request.server.auth;
  if (!auth) {
    throw new ApiError({
      httpStatus: API_STATUS.ServiceUnavailable,
      errorCode: 'auth_unavailable',
      message: 'Authentication is not configured.',
      description: 'This deployment has no auth backend wired up.',
      suggestedResolution: 'Set DATABASE_URL and BETTER_AUTH_SECRET, then restart.',
    });
  }

  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.raw.headers) });
  if (!session) throw errors.unauthorized();

  request.auth = session;
}

/**
 * A preHandler that requires a PROVEN email address, not merely a claimed one.
 *
 * Sign-up accepts any address without proof, so an unverified session says
 * nothing about who the caller is. That is fine for reading your own profile and
 * for the verify screen itself, and dangerous everywhere else — most sharply on
 * invitation acceptance, where the address IS the authorization: without this,
 * anyone could register as victim@company.com and redeem the invitation sent to
 * them, joining an organization they were never invited to.
 *
 * The domain model already says so — `User.isEmailVerified` "gates workspace
 * access". This is the server enforcing what the interface merely displays.
 *
 * Composes after `requireSession`.
 */
export async function requireVerifiedEmail(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const ctx = request.auth;
  if (!ctx) throw errors.unauthorized();

  if (!ctx.user.emailVerified) {
    throw new ApiError({
      httpStatus: API_STATUS.Forbidden,
      errorCode: 'email_not_verified',
      message: 'Verify your email address to continue.',
      description: 'This action needs a confirmed address, and yours has not been confirmed yet.',
      suggestedResolution: 'Enter the six-digit code we emailed you, or request a new one.',
    });
  }
}
