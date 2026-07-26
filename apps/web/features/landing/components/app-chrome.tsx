import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The product-screenshot vocabulary for the landing page.
 *
 * These are mockups, not the real screens — but they are built from the same
 * KDS tokens the real screens use, so what a visitor sees here is what they get
 * after signing up. Reusing the actual dashboard components would drag the
 * whole data layer onto a public page for no benefit; reusing the *tokens*
 * gets the honesty without the weight.
 */

export function AppWindow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-card border-border shadow-level-3 overflow-hidden rounded-md border',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The window's title strip: traffic lights, a label, and a status on the right. */
export function TitleBar({ label, status }: { label: string; status?: string }) {
  return (
    <div className="bg-surface border-border flex items-center gap-1.5 border-b px-3 py-2">
      <span aria-hidden="true" className="bg-border size-2 rounded-full" />
      <span aria-hidden="true" className="bg-border size-2 rounded-full" />
      <span aria-hidden="true" className="bg-border size-2 rounded-full" />
      <span className="text-caption text-subtle ml-2 font-mono tracking-wide">{label}</span>
      {status ? (
        <span className="text-caption text-subtle ml-auto font-mono tabular-nums">{status}</span>
      ) : null}
    </div>
  );
}

/**
 * A section rule inside a window — "Your briefing / 4 of 213 reviewed".
 */
export function PanelHead({ left, right }: { left: string; right?: string }) {
  return (
    <div className="text-caption text-subtle border-border mb-3 flex justify-between gap-4 border-b pb-2 font-mono tracking-widest uppercase">
      <span>{left}</span>
      {right ? <span>{right}</span> : null}
    </div>
  );
}

export type FlagTone = 'attention' | 'handled';

/**
 * The margin mark. Tone is semantic, not decorative:
 * `attention` is KDS Warning ("attention, review, upcoming, pending"),
 * `handled` is KDS Success ("completed, healthy, verified, safe").
 */
export function Flag({ tone = 'attention', children }: { tone?: FlagTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'text-caption mr-1.5 inline-block border-l-2 pl-1.5 align-[1px] font-mono tracking-wider uppercase',
        tone === 'attention' ? 'text-caution border-caution' : 'text-positive border-positive',
      )}
    >
      {children}
    </span>
  );
}

/** One line of a briefing: when, what, and where it came from. */
export function BriefRow({
  when,
  children,
  meta,
  last,
}: {
  when: string;
  children: ReactNode;
  meta?: string;
  /** Suppresses the divider on the final row. */
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-[3.25rem_minmax(0,1fr)] items-baseline gap-3 py-2',
        !last && 'border-border/60 border-b',
      )}
    >
      <span className="text-caption text-subtle font-mono tabular-nums">{when}</span>
      <span className="text-small text-foreground min-w-0 leading-snug">
        {children}
        {meta ? (
          <span className="text-caption text-subtle mt-0.5 block font-mono">{meta}</span>
        ) : null}
      </span>
    </div>
  );
}
