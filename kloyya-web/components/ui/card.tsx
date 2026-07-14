import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * KDS Card System.
 * "Every card includes: Header, Content, Optional Actions, Optional Footer,
 *  Loading State, Empty State, Error State."
 *
 * Design Manifesto: "Never overload a single card. Each card should answer one
 * question." The composition below deliberately offers no `variant` for density
 * or accent — a card that needs to shout is the wrong card.
 *
 * Loading / empty / error are not baked into this primitive. They are separate
 * components (Skeleton, EmptyState, ErrorState) that a card *contains*, because
 * a card in its error state should keep its header — the user needs to know
 * which card failed.
 */

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-card border-border rounded-lg border',
          'shadow-level-2',
          className,
        )}
        {...props}
      />
    );
  },
);

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start justify-between gap-4 px-6 pt-6 pb-4',
          className,
        )}
        {...props}
      />
    );
  },
);

/**
 * Renders an <h3> by default. Pass `as` to keep the document outline logical —
 * KDS requires a "Logical Heading Structure", which a fixed level would break
 * both on a page whose cards sit under an <h3> and on a page (login, sign-up)
 * where the card title *is* the document's h1.
 */
export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement> & { as?: 'h1' | 'h2' | 'h3' | 'h4' }
>(function CardTitle({ className, as: Comp = 'h3', ...props }, ref) {
  return (
    <Comp
      ref={ref}
      className={cn('text-title text-foreground font-semibold', className)}
      {...props}
    />
  );
});

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...props }, ref) {
  return (
    <p
      ref={ref}
      className={cn('text-small text-muted-foreground', className)}
      {...props}
    />
  );
});

/** Optional header actions. Sits opposite the title. */
export const CardActions = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardActions({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('flex shrink-0 items-center gap-2', className)}
        {...props}
      />
    );
  },
);

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn('px-6 pb-6', className)} {...props} />;
  },
);

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'border-border flex items-center gap-3 border-t px-6 py-4',
          className,
        )}
        {...props}
      />
    );
  },
);
