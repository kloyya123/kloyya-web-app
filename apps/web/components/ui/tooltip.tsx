'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * A tooltip supplements a label; it never replaces one. Radix exposes it via
 * `aria-describedby`, so an icon-only trigger still needs its own accessible
 * name (an `sr-only` span), or a screen reader announces "button" and nothing more.
 *
 * Tooltips are also unavailable on touch. Never put load-bearing information here.
 */
export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'bg-card border-border z-50 rounded-sm border px-2.5 py-1.5',
          'text-caption text-foreground shadow-level-3',
          'data-[state=delayed-open]:animate-fade-in',
          'max-w-64 text-balance',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});
