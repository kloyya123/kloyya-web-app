'use client';

import * as SwitchPrimitive from '@radix-ui/react-switch';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * KDS Form System lists "Toggle" as an input type.
 *
 * A switch takes effect immediately; a checkbox takes effect on submit. Use this
 * only for settings that apply the moment they change (notification prefs,
 * theme, AI preferences) — otherwise the user's mental model breaks.
 */
export const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 items-center rounded-full',
        'border-2 border-transparent',
        'transition-colors duration-200 ease-out',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-intelligence-blue',
        'data-[state=unchecked]:bg-border',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-5 rounded-full bg-white shadow-level-1',
          'transition-transform duration-200 ease-out',
          'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
        )}
      />
    </SwitchPrimitive.Root>
  );
});
