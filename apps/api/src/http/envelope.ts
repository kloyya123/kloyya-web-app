import { randomUUID } from 'node:crypto';
import type { ApiResponse } from '@kloyya/core';

/**
 * The KAS response envelope — the server half of the contract.
 *
 * The envelope *shapes* now live once in `@kloyya/core` (the same module the
 * web app's `types/api.ts` re-exports), so the two ends cannot drift. We import
 * them type-only — `verbatimModuleSyntax` erases these at build time, so the
 * compiled API carries no runtime dependency on the raw-TS core package — and
 * re-export them for the rest of the API to consume from one place.
 *
 * This is the seam the whole frontend-first architecture turns on: because the
 * mock services already returned exactly this shape, the real API returning it
 * means swapping the transport is a change of implementation, not of contract.
 */

export type { ApiResponse, ApiErrorPayload, Pagination, Timing } from '@kloyya/core';

/**
 * The version prefix, as a local runtime constant. Kept here (rather than
 * imported from @kloyya/core) so the built API has no runtime import of the
 * raw-TS core package. Sharing runtime values across the Node backend waits on
 * a package-build/bundle strategy — see also the duplicated API_STATUS.
 */
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
