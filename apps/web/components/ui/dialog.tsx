'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

/**
 * KDS Modals: "Small, Medium, Large, Fullscreen. Every modal traps focus,
 * supports keyboard navigation, and closes predictably."
 *
 * Radix Dialog provides the focus trap, focus restoration on close, Escape
 * handling, scroll lock, and `aria-modal`. This file adds KDS chrome and
 * nothing that could undo those behaviors.
 *
 * DialogTitle is mandatory — Radix warns loudly without one, because a modal
 * with no accessible name gives a screen-reader user no idea where they are.
 * Use VisuallyHidden if the design has no visible title.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

const contentVariants = cva(
  [
    'bg-card border-border fixed z-50 border shadow-level-5',
    'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
    'w-full',
    // The keyframes carry the -50%/-50% translate, so they must not fight the
    // static transform above. See scale-in/scale-out in tokens.css.
    'data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out',
  ],
  {
    variants: {
      size: {
        sm: 'max-w-sm rounded-lg',
        md: 'max-w-lg rounded-lg',
        lg: 'max-w-2xl rounded-lg',
        fullscreen: 'h-dvh max-w-none rounded-none',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]',
        'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
        className,
      )}
      {...props}
    />
  );
});

export interface DialogContentProps
  extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof contentVariants> {
  /** Hide the default close affordance for flows the user must resolve. */
  hideCloseButton?: boolean;
}

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent(
  { className, children, size, hideCloseButton = false, ...props },
  ref,
) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(contentVariants({ size }), className)}
        {...props}
      >
        {children}
        {!hideCloseButton ? (
          <DialogPrimitive.Close
            className={cn(
              'text-muted-foreground hover:text-foreground hover:bg-hover absolute top-4 right-4',
              'flex size-8 items-center justify-center rounded-sm',
              'transition-colors duration-150 ease-out',
            )}
          >
            <X aria-hidden="true" className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

export function DialogHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-1.5 px-6 pt-6 pb-4', className)} {...props} />;
}

export function DialogFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'border-border flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-title text-foreground pr-8 font-semibold', className)}
      {...props}
    />
  );
});

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-small text-muted-foreground', className)}
      {...props}
    />
  );
});

export function DialogBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 pb-6', className)} {...props} />;
}
