'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Marks the field invalid and lets FormField wire the error announcement. */
  isInvalid?: boolean;
  /** Decorative or interactive adornment rendered inside the field. */
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, isInvalid = false, leadingIcon, trailingSlot, type = 'text', ...props },
  ref,
) {
  const hasLeading = leadingIcon !== undefined;
  const hasTrailing = trailingSlot !== undefined;

  return (
    <div className="relative">
      {hasLeading ? (
        <span
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 [&_svg]:size-4"
        >
          {leadingIcon}
        </span>
      ) : null}

      <input
        ref={ref}
        type={type}
        // Communicates invalidity to assistive tech and to our styling, from
        // one source. Never style an error without announcing it.
        aria-invalid={isInvalid || undefined}
        className={cn(
          'bg-surface border-border text-foreground h-10 w-full rounded-sm border',
          'text-small placeholder:text-subtle',
          'transition-colors duration-200 ease-out',
          'hover:border-muted',
          'disabled:cursor-not-allowed disabled:opacity-50',
          // File inputs get their own button chrome; strip the default padding.
          'file:text-small file:mr-3 file:border-0 file:bg-transparent file:font-medium',
          hasLeading ? 'pl-9' : 'pl-3',
          hasTrailing ? 'pr-10' : 'pr-3',
          isInvalid && 'border-danger focus-visible:outline-danger',
          className,
        )}
        {...props}
      />

      {hasTrailing ? (
        <span className="absolute top-1/2 right-1 -translate-y-1/2">
          {trailingSlot}
        </span>
      ) : null}
    </div>
  );
});
