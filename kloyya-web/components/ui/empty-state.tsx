import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  icon?: LucideIcon;
  /** What is empty. States a fact, never an apology. */
  title: string;
  /**
   * Why it is empty, and what to do next.
   *
   * KDS: "Every empty state should explain why it's empty, suggest next action,
   * include illustration, include CTA, and never blame the user."
   *
   * Design Manifesto's example is the standard to hit — "No meetings today.
   * Perfect opportunity for focused work." Emptiness is an opportunity, not a
   * failure to populate a database.
   */
  description: string;
  /** The CTA. Optional only where genuinely no action exists. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <div
          aria-hidden="true"
          className="bg-hover text-muted-foreground mb-1 flex size-12 items-center justify-center rounded-full"
        >
          <Icon className="size-6" />
        </div>
      ) : null}

      <p className="text-body text-foreground font-medium">{title}</p>
      <p className="text-small text-muted-foreground max-w-sm text-balance">
        {description}
      </p>

      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
