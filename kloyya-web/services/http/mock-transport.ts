import {
  API_STATUS,
  API_VERSION,
  type ApiCollection,
  type ApiResponse,
  type ApiStatus,
  type CollectionQuery,
  type Pagination,
} from '@/types/api';
import { ApiError } from './errors';

/**
 * The mock transport. Everything the real HTTP client will do, minus the network.
 *
 * Its job is not to return data quickly — it is to make the frontend's loading,
 * empty, and error states *real*. A mock that resolves instantly and never fails
 * lets you ship a UI whose skeletons have never rendered and whose error paths
 * have never run. Those bugs then surface on the day the backend arrives.
 */

export interface MockTransportConfig {
  /** Simulated round-trip, milliseconds. Randomized within ±30% to expose races. */
  latencyMs: number;
  /** 0–1. Probability any given request rejects with a 503. */
  failureRate: number;
  /** Disable latency entirely. Tests set this; the app never does. */
  instant: boolean;
}

const config: MockTransportConfig = {
  latencyMs: 350,
  failureRate: 0,
  instant: false,
};

/** Tune the mock at runtime. Used by the dev failure-injection panel and tests. */
export function configureMockTransport(patch: Partial<MockTransportConfig>): void {
  Object.assign(config, patch);
}

export function getMockTransportConfig(): Readonly<MockTransportConfig> {
  return { ...config };
}

function correlationId(): string {
  return `corr_${crypto.randomUUID().slice(0, 12)}`;
}

async function simulateLatency(): Promise<number> {
  if (config.instant) return 0;
  // Jitter, so components that assume request ordering break here and not in prod.
  const jitter = 0.7 + Math.random() * 0.6;
  const duration = Math.round(config.latencyMs * jitter);
  await new Promise((resolve) => setTimeout(resolve, duration));
  return duration;
}

function maybeFail(): void {
  if (config.failureRate <= 0) return;
  if (Math.random() >= config.failureRate) return;

  throw new ApiError({
    errorCode: 'service_unavailable',
    httpStatus: API_STATUS.ServiceUnavailable,
    message: 'Kloyya is temporarily unavailable.',
    description: 'The service did not respond in time.',
    suggestedResolution: 'Try again in a moment.',
    correlationId: correlationId(),
    timestamp: new Date().toISOString(),
  });
}

/** Build a KAS-shaped success envelope around a single resource. */
export async function mockRespond<T>(data: T): Promise<ApiResponse<T>> {
  const durationMs = await simulateLatency();
  maybeFail();

  return {
    data,
    version: API_VERSION,
    correlationId: correlationId(),
    timing: { durationMs },
  };
}

/**
 * Cursor-paginated collection, per KAS ("cursor pagination is preferred").
 *
 * The cursor is the index of the first item on the next page, encoded. Opaque to
 * callers by design: nothing in the UI may decode it, so the real backend is
 * free to use a keyset cursor without breaking a single component.
 */
export async function mockRespondCollection<T>(
  all: readonly T[],
  query: CollectionQuery = {},
): Promise<ApiCollection<T>> {
  const durationMs = await simulateLatency();
  maybeFail();

  const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 100);
  const offset = decodeCursor(query.cursor);
  const page = all.slice(offset, offset + pageSize);

  const nextOffset = offset + pageSize;
  const hasNext = nextOffset < all.length;
  const hasPrevious = offset > 0;

  const pagination: Pagination = {
    currentCursor: query.cursor ?? null,
    nextCursor: hasNext ? encodeCursor(nextOffset) : null,
    previousCursor: hasPrevious ? encodeCursor(Math.max(0, offset - pageSize)) : null,
    pageSize,
    // KAS: "Total Count (when practical)". It is practical here, so we send it —
    // but no component may depend on it. See ApiCollection.
    totalCount: all.length,
  };

  return {
    data: page,
    pagination,
    version: API_VERSION,
    correlationId: correlationId(),
    timing: { durationMs },
  };
}

function encodeCursor(offset: number): string {
  return btoa(`offset:${offset}`);
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const decoded = atob(cursor);
    const [, raw] = decoded.split(':');
    const offset = Number.parseInt(raw ?? '', 10);
    return Number.isNaN(offset) || offset < 0 ? 0 : offset;
  } catch {
    // A malformed cursor is a client bug, not a server error. Start from the top
    // rather than 500-ing on a bad query string a user could type by hand.
    return 0;
  }
}

/** Raise a KAS-shaped error from a mock service. */
export function mockError(
  httpStatus: ApiStatus,
  errorCode: string,
  message: string,
  description: string,
  suggestedResolution: string,
): never {
  throw new ApiError({
    errorCode,
    httpStatus,
    message,
    description,
    suggestedResolution,
    correlationId: correlationId(),
    timestamp: new Date().toISOString(),
  });
}
