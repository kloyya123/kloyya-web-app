'use client';

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Check } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * Radix handles the roving tabindex: arrow keys move between options and Tab
 * enters/leaves the group as a single stop. Hand-rolled radio groups almost
 * always get this wrong and leave every option in the tab order.
 */
export const RadioGroup = forwardRef<
  ElementRef<typeof RadioGroupPrimitive.Root>,
  ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(function RadioGroup({ className, ...props }, ref) {
  return (
    <RadioGroupPrimitive.Root ref={ref} className={cn('grid gap-2', className)} {...props} />
  );
});

export const RadioGroupItem = forwardRef<
  ElementRef<typeof RadioGroupPrimitive.Item>,
  ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(function RadioGroupItem({ className, ...props }, ref) {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        'border-border aspect-square size-4 shrink-0 rounded-full border',
        'transition-colors duration-150 ease-out',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:border-intelligence-blue',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <span
          aria-hidden="true"
          className="bg-intelligence-blue block size-2 rounded-full"
        />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});

export interface ChoiceCardProps {
  value: string;
  label: string;
  /**
   * One line on what choosing this changes. Never marketing copy.
   *
   * `| undefined` is explicit: under `exactOptionalPropertyTypes`, a bare
   * `description?: string` rejects the `option.description` that every
   * `Option<T>` in a mapped list naturally produces.
   */
  description?: string | undefined;
  isSelected: boolean;
}

/**
 * A radio rendered as a card.
 *
 * Used where the options carry explanation and must stay visible — a dropdown
 * would hide the reasoning behind a click, and onboarding's whole job is to say
 * why it is asking.
 *
 * The whole card is the label, so the entire surface is the click target.
 */
export const ChoiceCard = forwardRef<
  ElementRef<typeof RadioGroupPrimitive.Item>,
  ChoiceCardProps
>(function ChoiceCard({ value, label, description, isSelected }, ref) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3',
        'transition-colors duration-150 ease-out',
        isSelected
          ? 'border-intelligence-blue bg-intelligence-blue/8'
          : 'border-border hover:bg-hover',
      )}
    >
      <RadioGroupItem ref={ref} value={value} className="mt-0.5" />
      <span className="min-w-0">
        <span className="text-small text-foreground block font-medium">{label}</span>
        {description ? (
          <span className="text-caption text-muted-foreground mt-0.5 block">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
});

export interface CheckCardProps {
  label: string;
  description?: string | undefined;
  isSelected: boolean;
  onToggle: () => void;
}

/**
 * The multi-select sibling of ChoiceCard, for goals.
 *
 * A native checkbox is kept in the DOM (visually replaced) rather than faking
 * one with `role="checkbox"`, so form semantics, space-key toggling, and
 * `:checked` all work without reimplementation.
 */
export function CheckCard({ label, description, isSelected, onToggle }: CheckCardProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3',
        'transition-colors duration-150 ease-out',
        'has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
        isSelected
          ? 'border-intelligence-blue bg-intelligence-blue/8'
          : 'border-border hover:bg-hover',
      )}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
          isSelected
            ? 'border-intelligence-blue bg-intelligence-blue text-on-intelligence-blue'
            : 'border-border',
        )}
      >
        {isSelected ? <Check className="size-3" /> : null}
      </span>
      <span className="min-w-0">
        <span className="text-small text-foreground block font-medium">{label}</span>
        {description ? (
          <span className="text-caption text-muted-foreground mt-0.5 block">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
