'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * A pill toggle for a single filter value — the shape used by the knowledge
 * category filter and the recommendation priority filter.
 *
 * `aria-pressed` carries the on/off state to assistive tech, and the label
 * always states the value, so selection never rides on colour alone (WCAG 1.4.1).
 */
export interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
}

export const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(function FilterChip(
  { active, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={active}
      className={cn(
        'text-caption rounded-full border px-3 py-1 font-medium transition-colors',
        active
          ? 'border-intelligence-blue/40 bg-intelligence-blue/12 text-link'
          : 'border-border text-muted-foreground hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
