'use client';

import * as LabelPrimitive from '@radix-ui/react-label';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Props a FormField hands to its control. Spread them onto the input. */
export interface FieldControlProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
  'aria-required': true | undefined;
}

export interface FormFieldProps {
  label: string;
  /**
   * Helper text. KDS: validation should be "Helpful, Never punitive."
   *
   * `| undefined` is explicit, not redundant: under `exactOptionalPropertyTypes`
   * a bare `description?: string` means "may be absent, never explicitly
   * undefined", which rejects the `errors.field?.message` that every React Hook
   * Form call site naturally produces.
   */
  description?: string | undefined;
  /** Present ⇒ the field is invalid. Announced politely, not assertively. */
  error?: string | undefined;
  isRequired?: boolean | undefined;
  /**
   * Hide the visual label but keep it for screen readers. Use sparingly —
   * a placeholder is not a label, and disappears the moment the user types.
   */
  hideLabel?: boolean | undefined;
  className?: string | undefined;
  children: (field: FieldControlProps) => ReactNode;
}

/**
 * Owns the accessibility contract for a single form control, so no individual
 * form has to remember it:
 *
 *   - a real <label for>, associated by generated id
 *   - `aria-describedby` pointing at the description *and* the error, in that
 *     order, so a screen reader hears the hint before the failure
 *   - `aria-invalid` set from the same source as the error styling — it is not
 *     possible to render a red border here without announcing why
 *   - the error in a `role="alert"` live region, announced on appearance
 *
 * Uses a render prop rather than cloneElement: it types the injected props,
 * survives arbitrary control components, and cannot silently drop them.
 */
export function FormField({
  label,
  description,
  error,
  isRequired = false,
  hideLabel = false,
  className,
  children,
}: FormFieldProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  const describedBy =
    [description ? descriptionId : null, error ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className={cn('space-y-2', className)}>
      <LabelPrimitive.Root
        htmlFor={id}
        className={cn(
          'text-small text-foreground block font-medium',
          hideLabel && 'sr-only',
        )}
      >
        {label}
        {isRequired ? (
          <span className="text-critical ml-0.5" aria-hidden="true">
            *
          </span>
        ) : null}
      </LabelPrimitive.Root>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': isRequired || undefined,
      })}

      {description ? (
        <p id={descriptionId} className="text-caption text-muted-foreground">
          {description}
        </p>
      ) : null}

      {/*
        Rendered unconditionally so the live region exists before the error
        appears. A `role="alert"` node inserted at the same moment as its text
        is announced inconsistently across screen readers.
      */}
      <p
        id={errorId}
        role="alert"
        className={cn('text-caption text-critical', !error && 'sr-only')}
      >
        {error ?? ''}
      </p>
    </div>
  );
}
