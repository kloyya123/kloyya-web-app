import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * KDS Loading States: "Skeleton Screens... Never display blank pages."
 *
 * A skeleton is decorative: it conveys "content is arriving," which the
 * surrounding live region already announces. It is therefore `aria-hidden`, and
 * the *container* owns the accessible announcement — see `LoadingRegion`.
 * Marking each shimmer bar as a status would flood a screen reader with noise.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('bg-hover animate-pulse rounded-sm', className)}
      {...props}
    />
  );
}

export interface LoadingRegionProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * What is being prepared, in the interface's voice.
   *
   * Design Manifesto: "Never show meaningless spinners." Loading states should
   * say "Analyzing your workspace…", not spin silently. This string is both the
   * screen-reader announcement and the developer's forcing function to name it.
   */
  label: string;
}

/**
 * Wraps a set of skeletons and announces, once, what is loading.
 * `aria-busy` lets assistive tech suppress the subtree until it settles.
 */
export function LoadingRegion({
  label,
  className,
  children,
  ...props
}: LoadingRegionProps) {
  return (
    <div role="status" aria-busy="true" className={cn(className)} {...props}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
