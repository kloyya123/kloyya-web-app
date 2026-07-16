import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { ApiErrorPayload } from './envelope.js';

/**
 * The status codes KAS enumerates — the same set the frontend's `API_STATUS`
 * already handles.
 */
export const API_STATUS = {
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  ValidationFailed: 422,
  RateLimited: 429,
  InternalError: 500,
  ServiceUnavailable: 503,
} as const;

export type ApiStatus = (typeof API_STATUS)[keyof typeof API_STATUS];

/**
 * A thrown error that carries everything the KAS error envelope needs. Service
 * code throws these; the handler below turns them into the wire format. This
 * mirrors the frontend's `ApiError` so the two ends speak one language.
 */
export class ApiError extends Error {
  readonly httpStatus: ApiStatus;
  readonly errorCode: string;
  readonly description: string;
  readonly suggestedResolution: string;
  readonly documentationLink?: string;

  constructor(params: {
    httpStatus: ApiStatus;
    errorCode: string;
    message: string;
    description: string;
    suggestedResolution: string;
    documentationLink?: string;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.httpStatus = params.httpStatus;
    this.errorCode = params.errorCode;
    this.description = params.description;
    this.suggestedResolution = params.suggestedResolution;
    if (params.documentationLink !== undefined) {
      this.documentationLink = params.documentationLink;
    }
  }
}

/** Convenience constructors for the common cases. */
export const errors = {
  notFound: (what: string) =>
    new ApiError({
      httpStatus: API_STATUS.NotFound,
      errorCode: 'not_found',
      message: `${what} not found.`,
      description: `No ${what.toLowerCase()} matches the given identifier.`,
      suggestedResolution: 'Check the identifier and try again.',
    }),
  unauthorized: () =>
    new ApiError({
      httpStatus: API_STATUS.Unauthorized,
      errorCode: 'unauthorized',
      message: 'Authentication required.',
      description: 'This request was not accompanied by a valid session.',
      suggestedResolution: 'Sign in and retry.',
    }),
  validation: (message: string) =>
    new ApiError({
      httpStatus: API_STATUS.ValidationFailed,
      errorCode: 'validation_failed',
      message,
      description: 'One or more fields did not pass validation.',
      suggestedResolution: 'Correct the highlighted fields and resubmit.',
    }),
};

/**
 * The single place an error becomes a response. Registered as Fastify's error
 * handler, so every thrown error — ours, a Zod failure, or an unexpected crash —
 * leaves as a well-formed KAS envelope with a correlation id, never a raw stack.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, request: FastifyRequest, reply: FastifyReply) => {
    const correlationId = request.correlationId;

    const payload = toErrorPayload(error, correlationId);

    // 5xx is our fault and worth a full log; 4xx is the caller's and is expected.
    if (payload.httpStatus >= 500) {
      request.log.error({ err: error, correlationId }, payload.message);
    } else {
      request.log.info({ correlationId, errorCode: payload.errorCode }, payload.message);
    }

    void reply.status(payload.httpStatus).send({ error: payload });
  });

  // A 404 for an unmatched route is still a KAS envelope, not Fastify's default.
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    const correlationId = request.correlationId;
    const payload: ApiErrorPayload = {
      errorCode: 'route_not_found',
      httpStatus: API_STATUS.NotFound,
      message: 'No such endpoint.',
      description: `${request.method} ${request.url} does not exist.`,
      suggestedResolution: 'Check the method and path against the API reference.',
      correlationId,
      timestamp: new Date().toISOString(),
    };
    void reply.status(API_STATUS.NotFound).send({ error: payload });
  });
}

function toErrorPayload(error: unknown, correlationId: string): ApiErrorPayload {
  const timestamp = new Date().toISOString();

  if (error instanceof ApiError) {
    return {
      errorCode: error.errorCode,
      httpStatus: error.httpStatus,
      message: error.message,
      description: error.description,
      suggestedResolution: error.suggestedResolution,
      correlationId,
      timestamp,
      ...(error.documentationLink ? { documentationLink: error.documentationLink } : {}),
    };
  }

  if (error instanceof ZodError) {
    const first = error.issues[0];
    return {
      errorCode: 'validation_failed',
      httpStatus: API_STATUS.ValidationFailed,
      message: first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Validation failed.',
      description: 'The request body or query did not match the expected schema.',
      suggestedResolution: 'Correct the highlighted fields and resubmit.',
      correlationId,
      timestamp,
    };
  }

  // Fastify's own errors — an empty JSON body, an unsupported media type, a
  // payload over the limit — carry the status they deserve. Reporting a client's
  // malformed request as "something went wrong on our end" is both a lie and an
  // alert nobody should be woken by; the caller can't fix a 500, but they can fix
  // a 400.
  const fastifyStatus = clientErrorStatus(error);
  if (fastifyStatus) {
    return {
      errorCode: fastifyErrorCode(error) ?? 'bad_request',
      httpStatus: fastifyStatus,
      message: 'That request could not be read.',
      description:
        error instanceof Error ? error.message : 'The request was malformed or unsupported.',
      suggestedResolution: 'Check the method, headers and body against the API reference.',
      correlationId,
      timestamp,
    };
  }

  // Anything else is an unexpected failure. Never leak its message to the client.
  return {
    errorCode: 'internal_error',
    httpStatus: API_STATUS.InternalError,
    message: 'Something went wrong on our end.',
    description: 'An unexpected error occurred while handling the request.',
    suggestedResolution: 'Retry in a moment. If it persists, contact support with the correlation id.',
    correlationId,
    timestamp,
  };
}

/** The KAS statuses we can report, indexed for lookup. */
const KNOWN_STATUSES = new Set<number>(Object.values(API_STATUS));

/**
 * A 4xx carried by a framework error, or null when this isn't the client's
 * fault. Anything 5xx falls through to the internal-error path deliberately: it
 * really is ours.
 */
function clientErrorStatus(error: unknown): ApiStatus | null {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return null;
  const status = (error as { statusCode?: unknown }).statusCode;
  if (typeof status !== 'number' || status < 400 || status >= 500) return null;
  return KNOWN_STATUSES.has(status) ? (status as ApiStatus) : API_STATUS.BadRequest;
}

/** Fastify's machine-readable code (FST_ERR_*), lowercased for the envelope. */
function fastifyErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code.length > 0 ? code.toLowerCase() : null;
}
