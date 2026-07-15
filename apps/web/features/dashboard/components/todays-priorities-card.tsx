'use client';

import { CheckSquare } from 'lucide-react';
import { Badge, EmptyState, type BadgeTone } from '@/components/ui';
import { formatRelativeTime } from '@/lib/format';
import type { PriorityLevel, Task } from '@/types/domain';
import { SidebarCard } from './dashboard';

const PRIORITY_TONE: Record<PriorityLevel, BadgeTone> = {
  Critical: 'danger',
  High: 'warning',
  Medium: 'info',
  Low: 'neutral',
  Background: 'neutral',
};

/**
 * Ranked by AI priority score, not by due date.
 *
 * KDA models `aiPriorityScore` separately from the human-set `priority`, and the
 * distinction matters: a task due in a week can outrank one due tomorrow when a
 * customer renewal depends on it. The badge shows the human priority; the order
 * shows Kloyya's.
 */
export function TodaysPrioritiesCard({ tasks }: { tasks: Task[] }) {
  const open = tasks.filter((task) => task.status !== 'done').slice(0, 4);

  return (
    <SidebarCard title="Today's priorities">
      {open.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Nothing outstanding."
          description="A rare and excellent position to be in."
        />
      ) : (
        <ul className="space-y-3">
          {open.map((task) => (
            <li key={task.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-small text-foreground">{task.title}</p>
                {task.dueAt ? (
                  <p className="text-caption text-subtle mt-0.5">
                    Due <time dateTime={task.dueAt}>{formatRelativeTime(task.dueAt)}</time>
                  </p>
                ) : null}
              </div>
              <Badge tone={PRIORITY_TONE[task.priority]} className="shrink-0">
                {task.priority}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </SidebarCard>
  );
}
