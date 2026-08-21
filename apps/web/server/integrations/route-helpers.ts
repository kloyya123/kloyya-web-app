import { API_STATUS, ApiError, errors } from '../http/errors';
import { isNotionIntegration } from './notion';
import type { LifecycleResult } from './service';
import type { SyncOutcome } from './sync';

/** The provider behind a card, named for user-facing errors. */
export function providerLabel(id: string): string {
  if (isNotionIntegration(id)) return 'Notion';
  return 'Google';
}

/** A lifecycle refusal (pause/resume/disconnect) → the KAS error that explains it. */
export function lifecycleToApiError(
  result: Extract<LifecycleResult, { ok: false }>,
  id: string,
): ApiError {
  switch (result.reason) {
    case 'unknown_integration':
      return errors.notFound('Integration');
    case 'no_profile':
      return errors.notFound('User profile');
    case 'wrong_state':
      return new ApiError({
        httpStatus: API_STATUS.Conflict,
        errorCode: 'wrong_connection_state',
        message: 'That integration is not in a state where this makes sense.',
        description: `${id} is currently "${result.current ?? 'unknown'}".`,
        suggestedResolution: 'Refresh the page to see its real state, then try again.',
      });
  }
}

/** A failed sync → the status its cause deserves (revoked=409, provider down=503). */
export function syncFailureToApiError(outcome: SyncOutcome, id: string): ApiError {
  const provider = providerLabel(id);
  switch (outcome.reason) {
    case 'revoked':
      return new ApiError({
        httpStatus: API_STATUS.Conflict,
        errorCode: 'connection_revoked',
        message: `${provider} no longer accepts this connection.`,
        description: 'The grant was revoked, or the account changed.',
        suggestedResolution: 'Reconnect the integration to resume syncing.',
      });
    case 'refresh_failed':
    case 'transient':
      return new ApiError({
        httpStatus: API_STATUS.ServiceUnavailable,
        errorCode: 'provider_unavailable',
        message: `${provider} is not responding right now.`,
        description: 'The connection is fine; the provider is rate-limiting or briefly unavailable.',
        suggestedResolution: 'Try again in a few minutes — nothing needs fixing.',
      });
    case 'not_connected':
      return new ApiError({
        httpStatus: API_STATUS.Conflict,
        errorCode: 'wrong_connection_state',
        message: 'That integration is not connected.',
        description: `${id} has no connection to sync.`,
        suggestedResolution: 'Connect it first.',
      });
    default:
      return new ApiError({
        httpStatus: API_STATUS.ServiceUnavailable,
        errorCode: 'sync_failed',
        message: `Kloyya could not read from ${provider}.`,
        description: 'The sync did not complete.',
        suggestedResolution: 'Try again; reconnect if it keeps failing.',
      });
  }
}
