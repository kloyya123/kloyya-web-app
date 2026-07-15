'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  isInvalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, isInvalid = false, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={isInvalid || undefined}
        className={cn(
          'bg-surface border-border text-foreground min-h-24 w-full rounded-sm border px-3 py-2',
          'text-small placeholder:text-subtle',
          'transition-colors duration-200 ease-out',
          'hover:border-muted',
          'disabled:cursor-not-allowed disabled:opacity-50',
          // Vertical only: horizontal resize breaks the grid on every layout.
          'resize-y',
          isInvalid && 'border-danger focus-visible:outline-danger',
          className,
        )}
        {...props}
      />
    );
  },
);
