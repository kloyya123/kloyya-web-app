'use client';

import { ArrowRight, CheckSquare, Circle } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import type { PriorityLevel, Task } from '@/types/domain';
import { SidebarCard } from './dashboard';

/** High/Critical read as an alert; everything else is quiet. */
function labelTone(priority: PriorityLevel): string {
  return priority === 'Critical' || priority === 'High'
    ? 'text-critical'
    : 'text-muted-foreground';
}

/**
 * Today's tasks, ranked by AI priority score, not by due date.
 *
 * KDA models `aiPriorityScore` separately from the human-set `priority`, and the
 * distinction matters: a task due in a week can outrank one due tomorrow when a
 * customer renewal depends on it. The order shows Kloyya's ranking; the
 * right-hand label shows the human priority (or, for a routine task, when it is
 * due) so the row explains its own placement.
 */
export function TodaysPrioritiesCard({ tasks }: { tasks: Task[] }) {
  const open = tasks.filter((task) => task.status !== 'done').slice(0, 5);

  return (
    <SidebarCard
      title="Tasks"
      action={
        <Link
          href="/tasks"
          className="text-caption text-link inline-flex items-center gap-1 rounded-sm hover:underline"
        >
          View all
          <ArrowRight aria-hidden="true" className="size-3" />
        </Link>
      }
    >
      {open.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Nothing outstanding."
          description="A rare and excellent position to be in."
        />
      ) : (
        <ul className="space-y-3">
          {open.map((task) => {
            const isPriority = task.priority === 'Critical' || task.priority === 'High';
            return (
              <li key={task.id} className="flex items-center gap-2.5">
                <Circle aria-hidden="true" className="text-subtle size-4 shrink-0" />
                <span className="text-small text-foreground min-w-0 flex-1 truncate">
                  {task.title}
                </span>
                <span className={cn('text-caption shrink-0 font-medium', labelTone(task.priority))}>
                  {isPriority ? task.priority : task.dueAt ? formatRelativeTime(task.dueAt) : '—'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SidebarCard>
  );
}
