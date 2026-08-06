import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The product-screenshot vocabulary for the landing page.
 *
 * A deliberately different palette from the real product's KDS tokens — see
 * the `.mockup` block in tokens.css. Reusing the actual dashboard components
 * would drag the whole data layer onto a public page for no benefit; this
 * gets a consistent, own-brand screenshot look without that weight.
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
        'mockup overflow-hidden rounded-md border border-[var(--mockup-border)] bg-[var(--mockup-card)] shadow-level-3',
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
    <div className="flex items-center gap-1.5 border-b border-[var(--mockup-border)] bg-[var(--mockup-surface)] px-3 py-2">
      <span aria-hidden="true" className="size-2 rounded-full bg-[var(--mockup-border)]" />
      <span aria-hidden="true" className="size-2 rounded-full bg-[var(--mockup-border)]" />
      <span aria-hidden="true" className="size-2 rounded-full bg-[var(--mockup-border)]" />
      <span className="ml-2 text-caption font-mono tracking-wide text-[var(--mockup-ink-soft)]">{label}</span>
      {status ? (
        <span className="ml-auto text-caption font-mono tabular-nums text-[var(--mockup-ink-soft)]">{status}</span>
      ) : null}
    </div>
  );
}

/**
 * A section rule inside a window — "Your briefing / 4 of 213 reviewed".
 */
export function PanelHead({ left, right }: { left: string; right?: string }) {
  return (
    <div className="mb-3 flex justify-between gap-4 border-b border-[var(--mockup-border)] pb-2 text-caption font-mono tracking-widest text-[var(--mockup-ink-soft)] uppercase">
      <span>{left}</span>
      {right ? <span>{right}</span> : null}
    </div>
  );
}

export type FlagTone = 'attention' | 'handled';

/**
 * The margin mark. Tone is semantic, not decorative:
 * `attention` calls out something waiting on you, `handled` says it's done.
 */
export function Flag({ tone = 'attention', children }: { tone?: FlagTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'mr-1.5 inline-block border-l-2 pl-1.5 align-[1px] text-caption font-mono tracking-wider uppercase',
        tone === 'attention'
          ? 'border-[var(--mockup-caution)] text-[var(--mockup-caution)]'
          : 'border-[var(--mockup-positive)] text-[var(--mockup-positive)]',
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
        !last && 'border-b border-[var(--mockup-border)]/60',
      )}
    >
      <span className="text-caption font-mono text-[var(--mockup-ink-soft)] tabular-nums">{when}</span>
      <span className="min-w-0 text-small leading-snug text-[var(--mockup-ink)]">
        {children}
        {meta ? (
          <span className="mt-0.5 block text-caption font-mono text-[var(--mockup-ink-soft)]">{meta}</span>
        ) : null}
      </span>
    </div>
  );
}
