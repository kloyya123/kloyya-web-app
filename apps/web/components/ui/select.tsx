'use client';

import { ChevronDown } from 'lucide-react';
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  isInvalid?: boolean;
}

/**
 * A styled native `<select>`.
 *
 * Deliberately not Radix. For a plain list of values with no icons, grouping, or
 * async loading, the native control is better on every axis that matters here:
 * it uses the platform picker on mobile, it works before hydration, it is
 * announced correctly by every screen reader, and it costs no JavaScript.
 *
 * Reach for a Radix Select only when the options need rich content — at which
 * point the native element genuinely cannot express them.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, isInvalid = false, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={isInvalid || undefined}
        className={cn(
          'bg-surface border-border text-foreground h-10 w-full rounded-sm border',
          'text-small appearance-none pr-9 pl-3',
          'transition-colors duration-200 ease-out',
          'hover:border-muted',
          'disabled:cursor-not-allowed disabled:opacity-50',
          isInvalid && 'border-danger focus-visible:outline-danger',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
      />
    </div>
  );
});
