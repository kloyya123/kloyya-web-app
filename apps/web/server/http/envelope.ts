import { randomUUID } from 'node:crypto';
import type { ApiResponse } from '@kloyya/core';

/**
 * The KAS response envelope — the server half of the contract.
 *
 * Ported unchanged from the retired Fastify API. The envelope *shapes* live once
 * in `@kloyya/core` (the same module the client's `types/api.ts` re-exports), so
 * the two ends cannot drift. Now that server and client share one Next.js app,
 * the runtime constants below could also live in core — kept here to keep the
 * port mechanical; consolidating is a later cleanup.
 */

export type { ApiResponse, ApiErrorPayload, Pagination, Timing } from '@kloyya/core';

export const API_VERSION = 'v1' as const;

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
