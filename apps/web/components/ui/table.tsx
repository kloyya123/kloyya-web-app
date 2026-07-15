'use client';

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * KDS Table System.
 *
 * Built on real `<table>` semantics rather than a grid of divs: screen readers
 * announce row and column position for free, and browsers give us `scope`,
 * `aria-sort`, and caption support that no div reimplementation gets right.
 *
 * Sorting, sticky headers, and responsive overflow are here because Tasks needs
 * them. Column resize, bulk actions, and row selection — also in the KDS list —
 * are deliberately absent until a feature consumes them. A component written
 * without a consumer is a guess.
 */

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /**
   * The table's accessible name. Required.
   *
   * An unnamed table forces a screen-reader user to infer what they landed in
   * from the first cell. Visually hidden by default; pass `showCaption` to
   * render it.
   */
  caption: string;
  showCaption?: boolean;
}

export function Table({
  caption,
  showCaption = false,
  className,
  children,
  ...props
}: TableProps) {
  return (
    // The wrapper scrolls, not the page. KDS: "No feature should break at any
    // supported size" — a wide table on mobile scrolls itself.
    <div className="border-border w-full overflow-x-auto rounded-lg border">
      <table className={cn('w-full caption-bottom border-collapse', className)} {...props}>
        <caption className={cn('text-caption text-subtle px-4 py-2 text-left', !showCaption && 'sr-only')}>
          {caption}
        </caption>
        {children}
      </table>
    </div>
  );
}

/**
 * Deliberately NOT sticky.
 *
 * `sticky top-0` looks right and does nothing: the wrapper below has
 * `overflow-x-auto`, which makes it — not the page — this header's scroll
 * container, and it never scrolls vertically. So the header never stuck to
 * anything. Worse, a sticky box inside a horizontal scroller leaks its full
 * width into the document's scroll width, so the *page* scrolled sideways on a
 * phone (656px at a 375px viewport) — a WCAG 1.4.10 Reflow failure, traded for a
 * feature that was never actually working.
 *
 * A genuinely sticky header needs the wrapper to own the vertical scroll too
 * (max-height + overflow-y-auto). That is a real design decision about whether a
 * data table scrolls inside itself, and it belongs to whoever asks for it.
 */
export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn('bg-surface border-border border-b', className)} {...props} />
  );
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-border divide-y', className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('hover:bg-hover transition-colors duration-100', className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'text-caption text-subtle px-4 py-3 text-left font-medium tracking-wide uppercase',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('text-small text-foreground px-4 py-3', className)} {...props} />;
}

export type SortDirection = 'asc' | 'desc';

export interface SortableHeaderProps<TColumn extends string = string> {
  columnId: TColumn;
  label: string;
  /** The column currently sorted. Only that column carries `aria-sort`. */
  sortBy: TColumn;
  sortDirection: SortDirection;
  onSort: (columnId: TColumn, direction: SortDirection) => void;
  className?: string;
  children?: ReactNode;
}

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;

export function SortableHeader<TColumn extends string = string>({
  columnId,
  label,
  sortBy,
  sortDirection,
  onSort,
  className,
}: SortableHeaderProps<TColumn>) {
  const isActive = sortBy === columnId;

  // Clicking the active column flips it. Clicking a new column starts ascending,
  // because "A first" and "soonest first" are what a reader expects on arrival.
  const nextDirection: SortDirection = isActive
    ? sortDirection === 'asc'
      ? 'desc'
      : 'asc'
    : 'asc';

  const Icon = !isActive ? ChevronsUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown;

  /**
   * The button's accessible name states the current sort *and* what pressing it
   * will do. "Task" alone tells a screen-reader user nothing about the control.
   */
  const accessibleName = isActive
    ? `${label}, sorted ${ARIA_SORT[sortDirection]}. Sort ${nextDirection === 'asc' ? 'ascending' : 'descending'}.`
    : `${label}. Sort ascending.`;

  return (
    <th
      scope="col"
      // Present on exactly one header at a time, per WAI-ARIA.
      {...(isActive ? { 'aria-sort': ARIA_SORT[sortDirection] } : {})}
      className={cn('p-0', className)}
    >
      <button
        type="button"
        onClick={() => onSort(columnId, nextDirection)}
        aria-label={accessibleName}
        className={cn(
          'text-caption flex w-full items-center gap-1.5 px-4 py-3 text-left font-medium tracking-wide uppercase',
          'hover:text-foreground transition-colors duration-100',
          isActive ? 'text-foreground' : 'text-subtle',
        )}
      >
        <span aria-hidden="true">{label}</span>
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
    </th>
  );
}
