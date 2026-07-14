'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { ErrorPresentation } from '@/lib/error-presentation';
import { Button } from './button';

export interface ErrorStateProps {
  error: ErrorPresentation;
  onRetry?: () => void;
  className?: string;
}

/**
 * KDS Error States: "Every error should include: Clear explanation, Recovery
 * steps, Retry action, Support reference, Technical details (when appropriate)."
 *
 * "When appropriate" is doing work: technical details are collapsed behind a
 * disclosure so they are available to someone filing a bug and invisible to
 * everyone else.
 *
 * The retry button appears only when `error.isRetryable`. Offering "Try again"
 * on a 403 teaches users that the button is a lie.
 */
export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  const [showDetails, setShowDetails] = useState(false);
  const canRetry = error.isRetryable && onRetry !== undefined;
  const hasDetails =
    error.technicalDetails !== undefined || error.correlationId !== undefined;

  return (
    <div
      // `alert` announces immediately; an error the user cannot see is not an
      // error state, it is a dead end.
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="bg-danger/12 text-critical mb-1 flex size-12 items-center justify-center rounded-full"
      >
        <AlertTriangle className="size-6" />
      </div>

      <p className="text-body text-foreground font-medium">{error.title}</p>
      <p className="text-small text-muted-foreground max-w-sm text-balance">
        {error.description}
      </p>
      <p className="text-small text-muted-foreground max-w-sm text-balance">
        {error.suggestedResolution}
      </p>

      {canRetry ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leadingIcon={<RotateCw aria-hidden="true" />}
          className="mt-2"
        >
          Try again
        </Button>
      ) : null}

      {hasDetails ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowDetails((open) => !open)}
            aria-expanded={showDetails}
            className="text-caption text-muted-foreground hover:text-foreground rounded-sm underline underline-offset-4"
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>

          {showDetails ? (
            <dl className="text-caption text-muted-foreground mt-2 space-y-1">
              {error.technicalDetails ? (
                <div className="flex gap-2">
                  <dt className="font-medium">Error</dt>
                  <dd className="font-mono">{error.technicalDetails}</dd>
                </div>
              ) : null}
              {error.correlationId ? (
                <div className="flex gap-2">
                  <dt className="font-medium">Reference</dt>
                  <dd className="font-mono">{error.correlationId}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
