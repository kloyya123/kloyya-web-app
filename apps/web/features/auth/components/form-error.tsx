'use client';

import { AlertCircle } from 'lucide-react';
import { toErrorPresentation } from '@/lib/error-presentation';

/**
 * Surfaces a submission failure above the form.
 *
 * Rendered as a live `role="alert"` so a screen-reader user learns the
 * submission failed without having to hunt for the reason. Field-level errors
 * stay on their fields; this is only for failures the whole form owns —
 * bad credentials, rate limits, a server that did not answer.
 */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;

  const { title, suggestedResolution } = toErrorPresentation(error);

  return (
    <div
      role="alert"
      className="border-danger/30 bg-danger/10 flex items-start gap-3 rounded-sm border px-3 py-2.5"
    >
      <AlertCircle
        aria-hidden="true"
        className="text-critical mt-0.5 size-4 shrink-0"
      />
      <div className="space-y-0.5">
        <p className="text-small text-foreground font-medium">{title}</p>
        <p className="text-caption text-muted-foreground">{suggestedResolution}</p>
      </div>
    </div>
  );
}
