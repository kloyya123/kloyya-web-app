'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

/**
 * KDS Notifications: "Variants: Information, Success, Warning, Danger,
 * AI Recommendation, Action Required. Notifications should be actionable."
 *
 * Design Manifesto: "Does this deserve interruption? If not, don't notify."
 * A toast interrupts. Reserve it for the outcome of an action the user just
 * took — never for ambient information, which belongs in the notification center.
 *
 * Styling comes from our tokens rather than sonner's defaults, per
 * "components never hardcode styles."
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      position="bottom-right"
      // Long enough to read a sentence, short enough not to nag.
      duration={5000}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group bg-card border-border text-foreground rounded-md border shadow-level-3',
          title: 'text-small font-medium',
          description: 'text-caption text-muted-foreground',
          actionButton: 'bg-intelligence-blue text-on-intelligence-blue rounded-sm',
          cancelButton: 'bg-hover text-foreground rounded-sm',
          error: 'border-danger/30',
          success: 'border-success/30',
          warning: 'border-warning/30',
          info: 'border-info/30',
        },
      }}
    />
  );
}

// Re-exported so features import the toast API from the design system rather
// than reaching for sonner directly. If we ever replace sonner, one file changes.
export { toast } from 'sonner';
