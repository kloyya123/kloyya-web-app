import { isApiError } from '@/services/http/errors';

/**
 * Everything KDS requires an error state to show:
 * "Clear explanation, Recovery steps, Retry action, Support reference,
 *  Technical details (when appropriate)."
 *
 * This is a pure mapping, not a service call. It lives in `lib/` so UI
 * components can consume the shape without reaching into the service layer.
 */
export interface ErrorPresentation {
  /** Clear explanation, in the interface's voice. Never an apology. */
  title: string;
  description: string;
  /** The recovery step. */
  suggestedResolution: string;
  /** Support reference. `undefined` when the failure never reached the API. */
  correlationId: string | undefined;
  /** Whether offering a retry is honest. Retrying a 403 is not. */
  isRetryable: boolean;
  /** Technical details, shown only on request. */
  technicalDetails: string | undefined;
}

/**
 * Map any thrown value onto something a user can act on.
 *
 * Product Principle: errors "explain what went wrong and how to fix it, in the
 * interface's voice." A raw `TypeError: undefined is not a function` is neither.
 * Unknown throwables therefore collapse to a generic, honest message and never
 * leak an internal stack into the UI.
 */
export function toErrorPresentation(error: unknown): ErrorPresentation {
  if (isApiError(error)) {
    return {
      title: error.message,
      description: error.description,
      suggestedResolution: error.suggestedResolution,
      correlationId: error.correlationId,
      isRetryable: error.isRetryable,
      technicalDetails: `${error.errorCode} (HTTP ${error.httpStatus})`,
    };
  }

  return {
    title: 'Something went wrong.',
    description:
      'Kloyya could not complete that request. The problem is on our side, not yours.',
    suggestedResolution: 'Try again. If it keeps happening, contact support.',
    correlationId: undefined,
    // A failure we cannot classify is assumed transient — offering a retry
    // costs the user one click; withholding it strands them.
    isRetryable: true,
    technicalDetails: error instanceof Error ? error.name : undefined,
  };
}
