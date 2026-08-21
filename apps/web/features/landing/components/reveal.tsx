'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Fade-and-rise as a section scrolls into view.
 *
 * IntersectionObserver rather than a scroll listener: the browser does the
 * work off the main thread, so a long page does not spend a frame budget on
 * geometry every time the wheel moves.
 *
 * Two details that decide whether this reads as polish or as jank:
 *
 *  • It only ever reveals. Once shown, the observer is disconnected — content
 *    that fades out again when you scroll back up is disorienting, and it makes
 *    a page feel like it is fighting you.
 *  • Anything already on screen at first paint is shown immediately, with no
 *    transition. Animating the hero into view after load is the thing that
 *    makes a site feel slow when it is not.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Stagger, in ms, for items revealed as a group. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    /**
     * Respect a stated preference for less motion. This is an enhancement; the
     * content is identical either way, so honouring it costs nothing.
     */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      // Fire slightly before the element's edge arrives, so the motion has
      // finished by the time it is properly in view rather than starting then.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={shown && delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        'motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out',
        shown ? 'translate-y-0 opacity-100' : 'motion-safe:translate-y-4 motion-safe:opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
