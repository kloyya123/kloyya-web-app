'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * Radix owns the hard parts: the hidden native input, `aria-checked` including
 * the `indeterminate` tri-state, and space-key activation.
 */
export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'border-border peer size-4 shrink-0 rounded-[4px] border',
        'transition-colors duration-150 ease-out',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-intelligence-blue data-[state=checked]:border-intelligence-blue',
        'data-[state=indeterminate]:bg-intelligence-blue data-[state=indeterminate]:border-intelligence-blue',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-on-intelligence-blue flex items-center justify-center">
        {props.checked === 'indeterminate' ? (
          <Minus aria-hidden="true" className="size-3" />
        ) : (
          <Check aria-hidden="true" className="size-3" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
