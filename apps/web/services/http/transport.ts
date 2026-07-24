import { API_STATUS, type ApiErrorPayload, type ApiResponse, type ApiStatus } from '@/types/api';
import { ApiError } from './errors';

/**
 * The real HTTP transport.
 *
 * The counterpart to mock-transport: same shapes, same errors, same contract —
 * a real network instead of a simulated one. Because the mock always spoke the
 * KAS envelope and threw ApiError, nothing above this line changes when a service
 * swaps from mock to HTTP. That was the whole point of building the frontend
 * first.
 *
 * `credentials: 'include'` keeps the Supabase session cookie attached. It is an
 * httpOnly cookie the browser holds and JavaScript cannot read — there is no
 * token to attach here, and that absence is the security property: a token this
 * code could read is a token an XSS could steal.
 */

/**
 * The API's origin prefix. The backend is now Next.js Route Handlers in this
 * same app under `/api/v1/**`, so every call is same-origin and relative — the
 * service files still name paths as `/v1/...`, and this prepends `/api`.
 *
 * (When the API was a separate Fastify server this read NEXT_PUBLIC_API_BASE_URL;
 * with one deployment there is no cross-origin base URL to configure.)
 */
export function apiOrigin(): string {
  return '/api';
}

/**
 * Coerce an arbitrary HTTP status into one KAS actually defines.
 *
 * A proxy or a CDN can answer with anything; the envelope only speaks the codes
 * KAS enumerates. Mapping the rest to the nearest honest one keeps the error
 * shape true rather than widening the contract to `number` for the sake of a
 * 418 nobody will ever send.
 */
const KNOWN_STATUSES = new Set<number>(Object.values(API_STATUS));

function toApiStatus(status: number): ApiStatus {
  if (KNOWN_STATUSES.has(status)) return status as ApiStatus;
  return status >= 500 ? API_STATUS.ServiceUnavailable : API_STATUS.BadRequest;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Serialized as JSON. Omit for GET. */
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * A network failure, before any HTTP status exists.
 *
 * Presented as an ApiError so callers have one error type to handle: a component
 * that must branch on "did this throw ApiError or TypeError" is a component that
 * will forget.
 */
function offlineError(cause: unknown): ApiError {
  return new ApiError({
    errorCode: 'network_unavailable',
    httpStatus: API_STATUS.ServiceUnavailable,
    message: 'Kloyya could not reach the server.',
    description: cause instanceof Error ? cause.message : 'The request never completed.',
    suggestedResolution: 'Check your connection and try again.',
    correlationId: 'client',
    timestamp: new Date().toISOString(),
  });
}

/** A response that isn't the envelope we contracted for. */
function malformedError(status: number, detail: string): ApiError {
  return new ApiError({
    errorCode: 'malformed_response',
    httpStatus: toApiStatus(status >= 400 ? status : 502),
    message: 'Kloyya received a response it could not read.',
    description: detail,
    suggestedResolution: 'Retry in a moment. If it persists, contact support.',
    correlationId: 'client',
    timestamp: new Date().toISOString(),
  });
}

function isErrorEnvelope(body: unknown): body is { error: ApiErrorPayload } {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false;
  const error = (body as { error: unknown }).error;
  return typeof error === 'object' && error !== null && 'errorCode' in error;
}

/**
 * Call the API and unwrap the KAS envelope.
 *
 * Errors arrive as `{ error: ApiErrorPayload }` and are rethrown as the same
 * ApiError the mock threw — including the correlationId, which is the thread
 * from a user's screenshot to the request in the logs.
 */
/** Shared by apiFetch and apiFetchEnvelope — one request/parse path, two unwrap depths. */
async function fetchEnvelope<T>(path: string, options: RequestOptions): Promise<ApiResponse<T> | null> {
  const method = options.method ?? 'GET';
  const url = `${apiOrigin()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      // The session cookie. Without this every authenticated call is anonymous.
      credentials: 'include',
      ...(options.body !== undefined
        ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(options.body) }
        : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (cause) {
    throw offlineError(cause);
  }

  // 204 and friends: nothing to unwrap, nothing to fail on.
  if (response.status === 204) return null;

  let body: unknown;
  const text = await response.text();
  if (text.length === 0) {
    if (response.ok) return null;
    throw malformedError(response.status, `The server returned ${response.status} with no body.`);
  }
  try {
    body = JSON.parse(text);
  } catch {
    throw malformedError(response.status, 'The server did not return JSON.');
  }

  if (isErrorEnvelope(body)) throw new ApiError(body.error);

  if (!response.ok) {
    // A failure that didn't use our envelope — a proxy, a gateway, a crash.
    throw malformedError(response.status, `The server returned ${response.status}.`);
  }

  const envelope = body as ApiResponse<T>;
  if (typeof envelope !== 'object' || envelope === null || !('data' in envelope)) {
    throw malformedError(response.status, 'The response was not a KAS envelope.');
  }

  return envelope;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const envelope = await fetchEnvelope<T>(path, options);
  return envelope ? envelope.data : (undefined as T);
}

/** Like apiFetch, but keeps the envelope's `pagination` — for cursor-paginated collections. */
export async function apiFetchEnvelope<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const envelope = await fetchEnvelope<T>(path, options);
  if (!envelope) throw malformedError(204, 'Expected a collection envelope, got an empty response.');
  return envelope;
}

/**
 * Upload a file as multipart/form-data, unwrapping the KAS envelope.
 *
 * A sibling of apiFetch for the one case it can't serve: apiFetch JSON-encodes
 * its body, but a file upload is multipart. The browser must set the multipart
 * boundary itself, so no content-type is passed here. Everything else — the
 * session cookie, the envelope, ApiError on failure — matches apiFetch, so
 * callers handle one error type and one response shape.
 */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const url = `${apiOrigin()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
  } catch (cause) {
    throw offlineError(cause);
  }

  const text = await response.text();
  if (text.length === 0) {
    if (response.ok) return undefined as T;
    throw malformedError(response.status, `The server returned ${response.status} with no body.`);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw malformedError(response.status, 'The server did not return JSON.');
  }

  if (isErrorEnvelope(body)) throw new ApiError(body.error);
  if (!response.ok) throw malformedError(response.status, `The server returned ${response.status}.`);

  const envelope = body as ApiResponse<T>;
  if (typeof envelope !== 'object' || envelope === null || !('data' in envelope)) {
    throw malformedError(response.status, 'The response was not a KAS envelope.');
  }
  return envelope.data;
}
