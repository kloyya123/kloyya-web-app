'use client';

import * as ProgressPrimitive from '@radix-ui/react-progress';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/cn';

export interface ProgressProps
  extends Omit<ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>, 'value'> {
  /** 0–100. Pass `null` for an indeterminate bar. */
  value: number | null;
  /**
   * Required. Design Manifesto: "Never show meaningless spinners."
   * A progress bar without a name tells the user that *something* is happening
   * but not what — which is the definition of a meaningless spinner.
   */
  label: string;
}

export const Progress = forwardRef<
  ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(function Progress({ className, value, label, ...props }, ref) {
  const clamped = value === null ? null : Math.min(100, Math.max(0, value));

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={clamped}
      aria-label={label}
      className={cn('bg-hover relative h-1.5 w-full overflow-hidden rounded-full', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'bg-intelligence-blue size-full flex-1 transition-transform duration-500 ease-out',
          // Indeterminate: Radix omits the value, so we sweep instead of fill.
          clamped === null && 'animate-pulse',
        )}
        style={{ transform: `translateX(-${100 - (clamped ?? 100)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
