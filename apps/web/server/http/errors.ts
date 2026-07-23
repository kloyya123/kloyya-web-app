import { ZodError } from 'zod';
import { API_STATUS, type ApiStatus } from '@kloyya/core/api';
import type { ApiErrorPayload } from './envelope';

/**
 * The KAS error language, ported from the retired Fastify API. The status set
 * now comes straight from `@kloyya/core` — server and client share one Next.js
 * app, so the old "no runtime import of raw-TS core" constraint is gone and the
 * duplicated enum with it. The Fastify error-handler registration was replaced
 * by `toErrorPayload` being called from the route wrapper (see ./handler.ts).
 */
export { API_STATUS, type ApiStatus };

/**
 * A thrown error that carries everything the KAS error envelope needs. Service
 * code throws these; the route wrapper turns them into the wire format. This
 * mirrors the client's `ApiError` so the two ends speak one language.
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
 * The single place an error becomes a wire payload. Byte-compatible with the
 * retired Fastify handler: ApiError passes through, Zod failures become a 422
 * naming the first offending field, and anything unexpected is a 500 that never
 * leaks its message.
 */
export function toErrorPayload(error: unknown, correlationId: string): ApiErrorPayload {
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

  // A body that isn't JSON when the handler asked for JSON. The caller can fix
  // a 400; they can't fix a 500 — and it isn't ours to be woken up for.
  if (error instanceof SyntaxError) {
    return {
      errorCode: 'bad_request',
      httpStatus: API_STATUS.BadRequest,
      message: 'That request could not be read.',
      description: 'The request body was malformed or not valid JSON.',
      suggestedResolution: 'Check the headers and body against the API reference.',
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
    suggestedResolution:
      'Retry in a moment. If it persists, contact support with the correlation id.',
    correlationId,
    timestamp,
  };
}
