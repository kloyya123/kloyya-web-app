/**
 * The Kloyya API contract, per "Kloyya Api Specification (kas).pdf".
 *
 * KAS names the parts of the success and error envelopes but shows no literal
 * JSON. The field names below are its names, camelCased. Nothing is added.
 *
 * The mock service layer implements this contract exactly, so swapping in the
 * real transport later is a change of implementation, not of shape.
 */

/** KAS: "Every public API is versioned. Example /v1 /v2 /v3." */
export const API_VERSION = 'v1' as const;

/**
 * KAS pagination: "Cursor pagination is preferred for scalability."
 *
 * `totalCount` is deliberately optional. KAS qualifies it as
 * "Total Count (when practical)" — so the UI must render correctly without it,
 * and must never compute page counts by assuming it exists.
 */
export interface Pagination {
  currentCursor: string | null;
  nextCursor: string | null;
  previousCursor: string | null;
  pageSize: number;
  totalCount?: number;
}

/** KAS: request timing, surfaced for the observability platform. */
export interface Timing {
  /** Total server-side duration, milliseconds. */
  durationMs: number;
  databaseMs?: number;
  externalApiMs?: number;
}

/**
 * KAS: "Every successful response follows one structure. Includes: Data,
 * Metadata, Pagination, Links, Version, Timing, Correlation ID, Optional warnings."
 */
export interface ApiResponse<T> {
  data: T;
  metadata?: Record<string, unknown>;
  pagination?: Pagination;
  links?: Record<string, string>;
  version: string;
  timing?: Timing;
  correlationId: string;
  warnings?: string[];
}

/** A cursor-paginated collection. Convenience alias over ApiResponse. */
export type ApiCollection<T> = ApiResponse<T[]> & { pagination: Pagination };

/**
 * KAS standard error codes. These are the HTTP statuses the spec enumerates;
 * it does not enumerate the string `Error Code` values, so those stay `string`.
 */
export const API_STATUS = {
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  PayloadTooLarge: 413,
  ValidationFailed: 422,
  RateLimited: 429,
  InternalError: 500,
  ServiceUnavailable: 503,
} as const;

export type ApiStatus = (typeof API_STATUS)[keyof typeof API_STATUS];

/**
 * KAS: "Every error includes: Error Code, HTTP Status, Message, Description,
 * Suggested Resolution, Correlation ID, Documentation Link, Timestamp."
 *
 * Note the shape maps directly onto the KDS error-state requirement that every
 * error carry a "Clear explanation, Recovery steps, Retry action, Support
 * reference": `message` explains, `suggestedResolution` is the recovery step,
 * `correlationId` is the support reference.
 */
export interface ApiErrorPayload {
  errorCode: string;
  httpStatus: ApiStatus;
  message: string;
  description: string;
  suggestedResolution: string;
  correlationId: string;
  documentationLink?: string;
  timestamp: string;
}

/** Query parameters shared by every collection endpoint (KAS filtering/sorting). */
export interface CollectionQuery {
  cursor?: string;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  search?: string;
}
