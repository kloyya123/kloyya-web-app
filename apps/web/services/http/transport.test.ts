import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, authFetch } from './transport';
import { type ApiError, isApiError } from './errors';

/**
 * The real transport.
 *
 * These tests matter because this is the seam: everything above it was built and
 * tested against the mock, and it only keeps working if the real thing speaks
 * exactly the same language — the KAS envelope in, ApiError out, always.
 */
function mockFetch(response: { status: number; body?: unknown; text?: string }) {
  // Typed params so the recorded calls are inspectable rather than `[]`.
  const spy = vi.fn(async (_url: string | URL, _init?: RequestInit) => {
    // 204 must be constructed with a null body; a string would throw here and
    // look like a transport failure that isn't one.
    const payload =
      response.status === 204
        ? null
        : (response.text ?? (response.body === undefined ? '' : JSON.stringify(response.body)));
    return new Response(payload, { status: response.status });
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it('unwraps the KAS envelope and returns only the data', async () => {
    mockFetch({
      status: 200,
      body: { data: { id: 'u1', email: 'a@b.test' }, version: 'v1', correlationId: 'corr_1' },
    });

    // Callers get the domain object, never the envelope — exactly what the mock
    // handed them.
    await expect(apiFetch('/v1/me')).resolves.toEqual({ id: 'u1', email: 'a@b.test' });
  });

  it('sends the session cookie', async () => {
    const spy = mockFetch({ status: 200, body: { data: null, version: 'v1', correlationId: 'c' } });

    await apiFetch('/v1/me');

    // Without credentials every authenticated call is silently anonymous.
    expect(spy.mock.calls[0]![1]).toMatchObject({ credentials: 'include' });
  });

  it('turns the KAS error envelope back into the ApiError the UI already handles', async () => {
    mockFetch({
      status: 403,
      body: {
        error: {
          errorCode: 'forbidden',
          httpStatus: 403,
          message: 'You do not have permission to do that.',
          description: 'This action requires the "org:update" permission.',
          suggestedResolution: 'Ask an administrator.',
          correlationId: 'corr_abc',
          timestamp: '2026-07-16T00:00:00.000Z',
        },
      },
    });

    const error = await apiFetch('/v1/settings', { method: 'PATCH', body: {} }).catch((e) => e);

    expect(isApiError(error)).toBe(true);
    expect((error as ApiError).errorCode).toBe('forbidden');
    expect((error as ApiError).httpStatus).toBe(403);
    // The correlation id is the thread from a screenshot to the server logs.
    expect((error as ApiError).correlationId).toBe('corr_abc');
    expect((error as ApiError).suggestedResolution).toBe('Ask an administrator.');
  });

  it('presents a network failure as an ApiError, not a raw TypeError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL, _init?: RequestInit) => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const error = await apiFetch('/v1/me').catch((e) => e);

    // One error type to handle. A component that must branch on "ApiError or
    // TypeError?" is one that will forget.
    expect(isApiError(error)).toBe(true);
    expect((error as ApiError).errorCode).toBe('network_unavailable');
  });

  it('rejects a non-envelope success rather than returning undefined data', async () => {
    mockFetch({ status: 200, body: { id: 'not-wrapped' } });

    const error = await apiFetch('/v1/me').catch((e) => e);

    // Silently returning `undefined` here would surface as a blank screen far
    // from the cause.
    expect(isApiError(error)).toBe(true);
    expect((error as ApiError).errorCode).toBe('malformed_response');
  });

  it('rejects a proxy error that never reached the API', async () => {
    mockFetch({ status: 502, text: '<html>Bad Gateway</html>' });

    const error = await apiFetch('/v1/me').catch((e) => e);
    expect(isApiError(error)).toBe(true);
    expect((error as ApiError).errorCode).toBe('malformed_response');
  });

  it('serializes a body and sets the content type', async () => {
    const spy = mockFetch({ status: 200, body: { data: {}, version: 'v1', correlationId: 'c' } });

    await apiFetch('/v1/onboarding', { method: 'POST', body: { jobTitle: 'Analyst' } });

    const init = spy.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
    expect(init.body).toBe(JSON.stringify({ jobTitle: 'Analyst' }));
  });

  it('handles an empty 204 without trying to parse it', async () => {
    mockFetch({ status: 204 });
    await expect(apiFetch('/v1/something')).resolves.toBeUndefined();
  });
});

describe('authFetch', () => {
  it('calls Better Auth outside the /v1 prefix', async () => {
    const spy = mockFetch({ status: 200, body: { user: { id: 'u1' } } });

    await authFetch('/sign-in/email', { body: { email: 'a@b.test', password: 'x' } });

    // Better Auth lives at /api/auth/*, not under /v1 — appending it there would
    // call routes that don't exist.
    const url = String(spy.mock.calls[0]![0]);
    expect(url).toContain('/api/auth/sign-in/email');
    expect(url).not.toContain('/v1/api/auth');
  });

  it('returns Better Auth’s own shape — it does not speak the KAS envelope', async () => {
    mockFetch({ status: 200, body: { token: 't', user: { id: 'u1', email: 'a@b.test' } } });

    // Pretending otherwise would mean a translation layer for a contract we
    // don't own.
    await expect(authFetch('/sign-in/email', { body: {} })).resolves.toMatchObject({
      user: { id: 'u1' },
    });
  });

  it('normalizes a Better Auth failure into ApiError', async () => {
    mockFetch({ status: 401, body: { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' } });

    const error = await authFetch('/sign-in/email', { body: {} }).catch((e) => e);

    expect(isApiError(error)).toBe(true);
    expect((error as ApiError).httpStatus).toBe(401);
    expect((error as ApiError).errorCode).toBe('invalid_credentials');
    // Better Auth's message is already user-facing; keep it rather than inventing one.
    expect((error as ApiError).message).toBe('Invalid email or password');
  });
});
