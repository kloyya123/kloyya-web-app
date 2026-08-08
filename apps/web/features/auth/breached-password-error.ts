import { ApiError } from '@/services/http/errors';
import { API_STATUS } from '@/types/api';

/** Shared between sign-up and reset — both submit a brand-new password. */
export function breachedPasswordError(count: number): ApiError {
  return new ApiError({
    errorCode: 'password_breached',
    httpStatus: API_STATUS.ValidationFailed,
    message: 'That password has appeared in known data breaches.',
    description: `It's been seen ${count.toLocaleString()} times in public breach data, which makes it easy to guess in an automated attack.`,
    suggestedResolution: 'Choose a password you have not used anywhere else.',
    correlationId: 'auth',
    timestamp: new Date().toISOString(),
  });
}
