'use client';

import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * KDS Avatars: "Profile Photo, Initials, Organization Logo, AI Agent Avatar,
 * Presence Status, Verification Badge."
 */
const avatarVariants = cva(
  'relative flex shrink-0 overflow-hidden rounded-full bg-hover',
  {
    variants: {
      size: {
        xs: 'size-6 text-caption',
        sm: 'size-8 text-caption',
        md: 'size-10 text-small',
        lg: 'size-12 text-body',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export interface AvatarProps
  extends ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {}

export const Avatar = forwardRef<ElementRef<typeof AvatarPrimitive.Root>, AvatarProps>(
  function Avatar({ className, size, ...props }, ref) {
    return (
      <AvatarPrimitive.Root
        ref={ref}
        className={cn(avatarVariants({ size }), className)}
        {...props}
      />
    );
  },
);

export const AvatarImage = forwardRef<
  ElementRef<typeof AvatarPrimitive.Image>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(function AvatarImage({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Image
      ref={ref}
      className={cn('aspect-square size-full object-cover', className)}
      {...props}
    />
  );
});

/**
 * Shown while the image loads and if it fails. Radix keeps it mounted until the
 * image resolves, so there is never a flash of empty circle.
 *
 * Marked `aria-hidden` because initials are a visual stand-in for a name that
 * the surrounding context already provides. "JD" read aloud is noise.
 */
export const AvatarFallback = forwardRef<
  ElementRef<typeof AvatarPrimitive.Fallback>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(function AvatarFallback({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      aria-hidden="true"
      className={cn(
        'bg-hover text-muted-foreground flex size-full items-center justify-center font-medium',
        className,
      )}
      {...props}
    />
  );
});
