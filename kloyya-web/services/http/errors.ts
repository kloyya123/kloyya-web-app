import { API_STATUS, type ApiErrorPayload, type ApiStatus } from '@/types/api';

/**
 * The single error type crossing the service boundary.
 *
 * UI never sees a raw fetch rejection, a Supabase error, or a mock throw — it
 * sees an ApiError carrying everything KDS says an error state must show:
 * a clear explanation, a recovery step, and a support reference.
 */
export class ApiError extends Error {
  readonly errorCode: string;
  readonly httpStatus: ApiStatus;
  readonly description: string;
  readonly suggestedResolution: string;
  readonly correlationId: string;
  readonly documentationLink: string | undefined;
  readonly timestamp: string;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.errorCode = payload.errorCode;
    this.httpStatus = payload.httpStatus;
    this.description = payload.description;
    this.suggestedResolution = payload.suggestedResolution;
    this.correlationId = payload.correlationId;
    this.documentationLink = payload.documentationLink;
    this.timestamp = payload.timestamp;
  }

  /**
   * Whether retrying the identical request could plausibly succeed.
   *
   * 5xx and 503 are transient. 429 is transient after backoff. Everything else
   * in the 4xx range describes a problem with the request itself: retrying a
   * 403 or a 422 cannot fix it, burns the caller's rate-limit budget, and delays
   * the error state the user needs to act on.
   */
  get isRetryable(): boolean {
    return (
      this.httpStatus === API_STATUS.RateLimited || this.httpStatus >= 500
    );
  }

  /** True when the session is gone and the user must re-authenticate. */
  get isAuthError(): boolean {
    return this.httpStatus === API_STATUS.Unauthorized;
  }

  /** True when the user is authenticated but lacks permission (RBAC/ABAC deny). */
  get isPermissionError(): boolean {
    return this.httpStatus === API_STATUS.Forbidden;
  }
}

/** Narrow an unknown catch binding to ApiError. */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
