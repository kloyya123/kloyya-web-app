'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * KDS Button System.
 *   Variants: Primary, Secondary, Ghost, Outline, Danger, Success, Link
 *   Sizes:    Small, Medium, Large, Icon Only
 *   States:   Default, Hover, Pressed, Loading, Disabled, Focused
 *
 * KDS: "Buttons always communicate a single primary action."
 *
 * Foregrounds come from the `--color-on-*` tokens, never chosen here — see the
 * contrast table in tokens.css for why Success and Warning carry dark text.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-medium select-none',
    'transition-colors duration-200 ease-out',
    // The focus ring is drawn by :focus-visible in globals.css. Do NOT add
    // `outline-none` here: Tailwind's utilities layer beats the base layer, so it
    // sets outline-style:none and the ring keeps its width and colour while
    // becoming invisible — every ghost and icon button silently loses its focus
    // indicator (WCAG 2.4.7). Mouse focus is already suppressed globally by
    // `:focus:not(:focus-visible)`, so there is nothing to suppress here.
    // Disabled and loading read identically to a pointer, and both are
    // announced via aria-disabled / aria-busy.
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-intelligence-blue text-on-intelligence-blue hover:bg-intelligence-blue/90 active:bg-intelligence-blue/95 shadow-level-1',
        secondary: 'bg-surface text-foreground border border-border hover:bg-hover',
        ghost: 'bg-transparent text-foreground hover:bg-hover',
        outline:
          'bg-transparent text-foreground border border-border hover:bg-hover hover:border-muted',
        danger:
          'bg-danger text-on-danger hover:bg-danger/90 active:bg-danger/95 shadow-level-1',
        success:
          'bg-success text-on-success hover:bg-success/90 active:bg-success/95 shadow-level-1',
        link: 'bg-transparent text-link underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-8 rounded-sm px-3 text-small [&_svg]:size-4',
        md: 'h-10 rounded-sm px-4 text-small [&_svg]:size-4',
        lg: 'h-12 rounded-md px-6 text-body [&_svg]:size-5',
        icon: 'size-10 rounded-sm p-0 [&_svg]:size-5',
      },
    },
    compoundVariants: [
      // A link is text, not a control surface: it should not inherit box sizing.
      { variant: 'link', size: ['sm', 'md', 'lg'], class: 'h-auto px-0' },
    ],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'>,
    VariantProps<typeof buttonVariants> {
  /** Render as the child element (e.g. a Next `<Link>`), keeping button styling. */
  asChild?: boolean;
  isLoading?: boolean;
  isDisabled?: boolean;
  /**
   * Announced to screen readers while `isLoading`, replacing the label.
   * Without it, a spinner is a silent, nameless control.
   */
  loadingLabel?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    asChild = false,
    isLoading = false,
    isDisabled = false,
    loadingLabel = 'Loading',
    leadingIcon,
    trailingIcon,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  const inert = isLoading || isDisabled;

  // `asChild` forwards a single child through Slot, so the loading affordances
  // (which add sibling nodes) cannot apply. Callers who need both should wrap
  // the child instead.
  if (asChild) {
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        data-disabled={inert || undefined}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      // `disabled` (not aria-disabled) so the control leaves the tab order and
      // cannot be activated. Loading is a disabled state that also says why.
      disabled={inert}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 aria-hidden="true" className="animate-spin" />
          {/* The visible label stays put so the button does not resize mid-click.
              Screen readers hear the loading label instead. */}
          <span aria-hidden="true">{children}</span>
          <span className="sr-only">{loadingLabel}</span>
        </>
      ) : (
        <>
          {leadingIcon}
          {children}
          {trailingIcon}
        </>
      )}
    </button>
  );
});

export { buttonVariants };
