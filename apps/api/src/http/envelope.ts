import { randomUUID } from 'node:crypto';

/**
 * The KAS response envelope — the server half of the contract the frontend's
 * `types/api.ts` already models. Every response the API emits, success or error,
 * has this shape. The field names are KAS's names; nothing is added.
 *
 * This is the seam the whole frontend-first architecture turns on: because the
 * mock services already returned exactly this shape, the real API returning it
 * means swapping the transport is a change of implementation, not of contract.
 */

export const API_VERSION = 'v1' as const;

export interface Pagination {
  currentCursor: string | null;
  nextCursor: string | null;
  previousCursor: string | null;
  pageSize: number;
  totalCount?: number;
}

export interface Timing {
  durationMs: number;
  databaseMs?: number;
  externalApiMs?: number;
}

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

export interface ApiErrorPayload {
  errorCode: string;
  httpStatus: number;
  message: string;
  description: string;
  suggestedResolution: string;
  correlationId: string;
  documentationLink?: string;
  timestamp: string;
}

/** A correlation id threads a request through logs, DB calls, and the audit log. */
export function newCorrelationId(): string {
  return `corr_${randomUUID().slice(0, 12)}`;
}

/** Wrap a resource in the success envelope. */
export function ok<T>(
  data: T,
  correlationId: string,
  extra?: Partial<Omit<ApiResponse<T>, 'data' | 'version' | 'correlationId'>>,
): ApiResponse<T> {
  return {
    data,
    version: API_VERSION,
    correlationId,
    ...extra,
  };
}
