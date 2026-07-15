import { describe, expect, it } from 'vitest';
import { API_STATUS, type ApiErrorPayload } from '@/types/api';
import { ApiError, isApiError } from './errors';

function payload(overrides: Partial<ApiErrorPayload> = {}): ApiErrorPayload {
  return {
    errorCode: 'test_error',
    httpStatus: API_STATUS.InternalError,
    message: 'Something went wrong.',
    description: 'A test error.',
    suggestedResolution: 'Try again.',
    correlationId: 'corr_test',
    timestamp: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('ApiError', () => {
  it('exposes the KAS error envelope fields and uses message as Error.message', () => {
    const error = new ApiError(payload({ message: 'Rate limited.' }));

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect(error.message).toBe('Rate limited.');
    expect(error.correlationId).toBe('corr_test');
    expect(error.suggestedResolution).toBe('Try again.');
  });

  it('leaves documentationLink undefined when the payload omits it', () => {
    expect(new ApiError(payload()).documentationLink).toBeUndefined();
  });

  describe('isRetryable', () => {
    // Retrying these can plausibly succeed.
    it.each([
      ['429 Rate Limited', API_STATUS.RateLimited],
      ['500 Internal Error', API_STATUS.InternalError],
      ['503 Service Unavailable', API_STATUS.ServiceUnavailable],
    ])('is true for %s', (_label, httpStatus) => {
      expect(new ApiError(payload({ httpStatus })).isRetryable).toBe(true);
    });

    // Retrying these cannot fix them, and burns the caller's rate-limit budget.
    it.each([
      ['400 Bad Request', API_STATUS.BadRequest],
      ['401 Unauthorized', API_STATUS.Unauthorized],
      ['403 Forbidden', API_STATUS.Forbidden],
      ['404 Not Found', API_STATUS.NotFound],
      ['409 Conflict', API_STATUS.Conflict],
      ['422 Validation Failed', API_STATUS.ValidationFailed],
    ])('is false for %s', (_label, httpStatus) => {
      expect(new ApiError(payload({ httpStatus })).isRetryable).toBe(false);
    });
  });

  it('distinguishes an expired session from a permission denial', () => {
    const unauthorized = new ApiError(payload({ httpStatus: API_STATUS.Unauthorized }));
    const forbidden = new ApiError(payload({ httpStatus: API_STATUS.Forbidden }));

    expect(unauthorized.isAuthError).toBe(true);
    expect(unauthorized.isPermissionError).toBe(false);

    expect(forbidden.isPermissionError).toBe(true);
    expect(forbidden.isAuthError).toBe(false);
  });
});

describe('isApiError', () => {
  it('narrows an ApiError and rejects other throwables', () => {
    expect(isApiError(new ApiError(payload()))).toBe(true);
    expect(isApiError(new Error('plain'))).toBe(false);
    expect(isApiError('a string')).toBe(false);
    expect(isApiError(null)).toBe(false);
  });
});
