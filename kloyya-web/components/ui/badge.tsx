import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * KDS Badge System.
 *   Types: Status, Priority, Role, Verification, AI Confidence, Risk,
 *          Organization, Category.
 *   "Use restrained color."
 *
 * Two constraints shaped this component.
 *
 * 1. Accessibility. A badge is caption-sized (12px), so it needs 4.5:1. Accent
 *    text on the dark card surface does not get there — Intelligence Blue on
 *    #1A2332 is 3.06:1. So the *label* is always `--color-foreground`, and the
 *    accent appears as a tinted background, a hairline border, and a dot.
 *
 * 2. WCAG 1.4.1 (Use of Color). Meaning must not be carried by hue alone. The
 *    label text always states the meaning; the dot only reinforces it. A
 *    colorblind user reads "High Risk", not a red circle.
 */
const badgeVariants = cva(
  [
    'inline-flex items-center gap-1.5 whitespace-nowrap',
    'rounded-full border px-2.5 py-0.5',
    'text-caption font-medium',
    'text-foreground',
  ],
  {
    variants: {
      tone: {
        neutral: 'bg-muted/12 border-border',
        primary: 'bg-intelligence-blue/12 border-intelligence-blue/25',
        ai: 'bg-executive-purple/12 border-executive-purple/25',
        success: 'bg-success/12 border-success/25',
        warning: 'bg-warning/12 border-warning/25',
        danger: 'bg-danger/12 border-danger/25',
        info: 'bg-info/12 border-info/25',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

const dotVariants = cva('size-1.5 shrink-0 rounded-full', {
  variants: {
    tone: {
      neutral: 'bg-muted',
      primary: 'bg-intelligence-blue',
      ai: 'bg-executive-purple',
      success: 'bg-success',
      warning: 'bg-warning',
      danger: 'bg-danger',
      info: 'bg-info',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Show the tone dot. Purely reinforcing; never the sole carrier of meaning. */
  withDot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, tone, withDot = false, children, ...props },
  ref,
) {
  return (
    <span ref={ref} className={cn(badgeVariants({ tone }), className)} {...props}>
      {withDot ? <span aria-hidden="true" className={dotVariants({ tone })} /> : null}
      {children}
    </span>
  );
});

export { badgeVariants };
