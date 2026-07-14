'use client';

import { Check, Sparkles } from 'lucide-react';
import {
  Badge,
  Button,
  SortableHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type BadgeTone,
} from '@/components/ui';
import { priorityFromDecisionScore } from '@/lib/decision-score';
import { formatRelativeTime } from '@/lib/format';
import type { TaskFilters, TaskSortField } from '@/services/tasks/types';
import type { PriorityLevel, Task, TaskStatus } from '@/types/domain';

const PRIORITY_TONE: Record<PriorityLevel, BadgeTone> = {
  Critical: 'danger',
  High: 'warning',
  Medium: 'info',
  Low: 'neutral',
  Background: 'neutral',
};

const STATUS_TONE: Record<TaskStatus, BadgeTone> = {
  todo: 'neutral',
  in_progress: 'primary',
  blocked: 'danger',
  done: 'success',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

export interface TaskTableProps {
  tasks: Task[];
  filters: TaskFilters;
  onSort: (columnId: TaskSortField, direction: 'asc' | 'desc') => void;
  onComplete: (task: Task) => void;
  isUpdating: boolean;
}

export function TaskTable({ tasks, filters, onSort, onComplete, isUpdating }: TaskTableProps) {
  return (
    <Table caption="Your tasks, ranked by Kloyya's priority score">
      <TableHeader>
        <TableRow>
          <SortableHeader<TaskSortField>
            columnId="title"
            label="Task"
            sortBy={filters.sortBy}
            sortDirection={filters.sortDirection}
            onSort={onSort}
          />
          <SortableHeader<TaskSortField>
            columnId="aiPriority"
            label="Kloyya's rank"
            sortBy={filters.sortBy}
            sortDirection={filters.sortDirection}
            onSort={onSort}
          />
          <TableHead>Priority</TableHead>
          <SortableHeader<TaskSortField>
            columnId="status"
            label="Status"
            sortBy={filters.sortBy}
            sortDirection={filters.sortDirection}
            onSort={onSort}
          />
          <SortableHeader<TaskSortField>
            columnId="dueAt"
            label="Due"
            sortBy={filters.sortBy}
            sortDirection={filters.sortDirection}
            onSort={onSort}
          />
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell className="max-w-80">
              <span className={task.status === 'done' ? 'text-subtle line-through' : ''}>
                {task.title}
              </span>
            </TableCell>

            <TableCell>
              <AiRank task={task} />
            </TableCell>

            <TableCell>
              <Badge tone={PRIORITY_TONE[task.priority]} withDot>
                {task.priority}
              </Badge>
            </TableCell>

            <TableCell>
              <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</Badge>
            </TableCell>

            <TableCell className="text-subtle whitespace-nowrap">
              {task.dueAt ? (
                <time dateTime={task.dueAt}>{formatRelativeTime(task.dueAt)}</time>
              ) : (
                <span className="text-subtle">No date</span>
              )}
            </TableCell>

            <TableCell className="text-right">
              {task.status !== 'done' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  isDisabled={isUpdating}
                  onClick={() => onComplete(task)}
                  leadingIcon={<Check aria-hidden="true" />}
                >
                  Done
                  <span className="sr-only">: {task.title}</span>
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Kloyya's ranking of the task, and — when they disagree — the fact that it
 * differs from the human-set priority.
 *
 * The disagreement is the product working, not a bug to hide. KDA models the
 * two scores separately precisely so a task the owner marked "Medium" can be
 * surfaced when a customer renewal starts depending on it.
 */
function AiRank({ task }: { task: Task }) {
  const kloyyaView = priorityFromDecisionScore(task.aiPriorityScore);
  const disagrees = kloyyaView !== task.priority;

  const score = (
    <span className="text-small text-foreground font-medium tabular-nums">
      {task.aiPriorityScore}
    </span>
  );

  if (!disagrees) return score;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="flex items-center gap-1.5 rounded-sm">
          {score}
          <Sparkles aria-hidden="true" className="text-ai size-3.5" />
          <span className="sr-only">
            Kloyya ranks this {kloyyaView}, not {task.priority}.
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        Kloyya ranks this <strong>{kloyyaView}</strong>, though it is marked{' '}
        {task.priority}.
      </TooltipContent>
    </Tooltip>
  );
}
