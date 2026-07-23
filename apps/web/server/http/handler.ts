import { NextResponse, type NextRequest } from 'next/server';
import type { AppDb } from '@kloyya/db/client';
import type { Identity } from '../auth/identity';
import { getDeps } from '../deps';
import { newCorrelationId } from './envelope';
import { API_STATUS, ApiError, errors, toErrorPayload } from './errors';

/**
 * The one wrapper every KAS route handler goes through.
 *
 * It does exactly what the Fastify preHandlers + error handler used to do, in
 * one place: resolve dependencies, authenticate (and optionally require a
 * proven email), and turn every thrown error — ours, a Zod failure, or an
 * unexpected crash — into a well-formed KAS error envelope with a correlation
 * id, never a raw stack.
 *
 * Guards:
 *   'session'  — a valid Supabase session is required (401 otherwise).
 *   'verified' — additionally, the email must be confirmed (403 otherwise).
 *                Sign-up accepts any address without proof, so an unverified
 *                session says nothing about who the caller is — this is the
 *                server enforcing what the interface merely displays.
 *
 * Public endpoints (health, OAuth callbacks) don't use this wrapper's guard;
 * they use `publicRoute` below, or handle redirects themselves.
 */
export interface RouteCtx {
  identity: Identity;
  db: AppDb;
  correlationId: string;
  params: Record<string, string>;
}

type RouteParams = { params: Promise<Record<string, string>> };

export function kasRoute(
  guard: 'session' | 'verified',
  handler: (req: NextRequest, ctx: RouteCtx) => Promise<Response>,
) {
  return async (req: NextRequest, route?: RouteParams): Promise<Response> => {
    const correlationId = newCorrelationId();
    try {
      const deps = await getDeps();
      const identity = await deps.getIdentity();
      if (!identity) throw errors.unauthorized();
      if (guard === 'verified' && !identity.emailVerified) {
        // Byte-identical to the retired API's requireVerifiedEmail guard.
        throw new ApiError({
          httpStatus: API_STATUS.Forbidden,
          errorCode: 'email_not_verified',
          message: 'Verify your email address to continue.',
          description:
            'This action needs a confirmed address, and yours has not been confirmed yet.',
          suggestedResolution: 'Enter the six-digit code we emailed you, or request a new one.',
        });
      }

      const params = route ? await route.params : {};
      const response = await handler(req, { identity, db: deps.db, correlationId, params });
      response.headers.set('x-correlation-id', correlationId);
      return response;
    } catch (error) {
      return errorResponse(error, correlationId);
    }
  };
}

/** An unauthenticated KAS route (health). Same error envelope, no guard. */
export function publicRoute(
  handler: (
    req: NextRequest,
    ctx: { db: AppDb; correlationId: string; params: Record<string, string> },
  ) => Promise<Response>,
) {
  return async (req: NextRequest, route?: RouteParams): Promise<Response> => {
    const correlationId = newCorrelationId();
    try {
      const deps = await getDeps();
      const params = route ? await route.params : {};
      const response = await handler(req, { db: deps.db, correlationId, params });
      response.headers.set('x-correlation-id', correlationId);
      return response;
    } catch (error) {
      return errorResponse(error, correlationId);
    }
  };
}

function errorResponse(error: unknown, correlationId: string): NextResponse {
  const payload = toErrorPayload(error, correlationId);
  // 5xx is our fault and worth a full log; 4xx is the caller's and is expected.
  if (payload.httpStatus >= 500) {
    console.error(`[api] ${payload.message}`, { correlationId, error });
  }
  return NextResponse.json(
    { error: payload },
    { status: payload.httpStatus, headers: { 'x-correlation-id': correlationId } },
  );
}
