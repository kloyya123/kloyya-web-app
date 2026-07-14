'use client';

import { CheckSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton,
  toast,
} from '@/components/ui';
import { toErrorPresentation } from '@/lib/error-presentation';
import { useDashboard } from '@/hooks/use-intelligence';
import { DEFAULT_TASK_FILTERS, type TaskFilters as Filters, type TaskSortField } from '@/services/tasks/types';
import type { Task } from '@/types/domain';
import { useTaskFilterNavigation, useTasks, useUpdateTaskStatus } from '../hooks/use-tasks';
import { TaskFilters } from './task-filters';
import { TaskTable } from './task-table';

export interface TasksViewProps {
  /** Parsed and validated by the page, on the server. Never a raw query string. */
  filters: Filters;
}

export function TasksView({ filters }: TasksViewProps) {
  const { data, isPending, isError, error, refetch } = useTasks(filters);
  const navigate = useTaskFilterNavigation();
  const updateStatus = useUpdateTaskStatus();

  // Projects for the filter dropdown come from the dashboard's cached payload,
  // so opening Tasks costs no extra request.
  const { data: dashboard } = useDashboard();

  const isFiltered =
    filters.status.length > 0 ||
    filters.priority.length > 0 ||
    filters.projectId !== null ||
    filters.search !== '';

  function onSort(columnId: TaskSortField, direction: 'asc' | 'desc') {
    navigate({ ...filters, sortBy: columnId, sortDirection: direction }, { resetCursor: true });
  }

  function onComplete(task: Task) {
    updateStatus.mutate(
      { id: task.id, status: 'done' },
      {
        onSuccess: () => toast.success(`Completed “${task.title}”.`),
        onError: (mutationError) => toast.error(toErrorPresentation(mutationError).title),
      },
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-heading-m text-foreground font-semibold">Tasks</h1>
        <p className="text-small text-muted-foreground">
          Ordered by Kloyya&rsquo;s priority score, not by deadline.
        </p>
      </header>

      <TaskFilters
        filters={filters}
        onChange={navigate}
        resultCount={data?.pagination.totalCount}
        projects={dashboard?.projects ?? []}
      />

      {isPending ? (
        <TaskTableSkeleton />
      ) : isError ? (
        <Card>
          <ErrorState error={toErrorPresentation(error)} onRetry={() => void refetch()} />
        </Card>
      ) : data.data.length === 0 ? (
        <Card>
          {isFiltered ? (
            <EmptyState
              icon={CheckSquare}
              title="No tasks match those filters."
              description="Try widening the status or priority, or clearing the search."
              action={
                <Button
                  variant="secondary"
                  onClick={() => navigate(DEFAULT_TASK_FILTERS, { resetCursor: true })}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={CheckSquare}
              title="Nothing outstanding."
              description="A rare and excellent position to be in. Kloyya will surface work as it arrives."
            />
          )}
        </Card>
      ) : (
        <>
          <TaskTable
            tasks={data.data}
            filters={filters}
            onSort={onSort}
            onComplete={onComplete}
            isUpdating={updateStatus.isPending}
          />
          <Pagination
            hasPrevious={data.pagination.previousCursor !== null}
            hasNext={data.pagination.nextCursor !== null}
            onPrevious={() =>
              navigate({ ...filters, cursor: data.pagination.previousCursor })
            }
            onNext={() => navigate({ ...filters, cursor: data.pagination.nextCursor })}
          />
        </>
      )}
    </div>
  );
}

/**
 * Cursor pagination gives no page numbers, by design — KAS marks `totalCount`
 * as "when practical", so the UI must never compute "page 3 of 7" from it.
 * Previous and Next are the only claims we can make honestly.
 */
function Pagination({
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: {
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (!hasPrevious && !hasNext) return null;

  return (
    <nav aria-label="Task pages" className="flex items-center justify-end gap-2">
      <Button
        variant="secondary"
        size="sm"
        isDisabled={!hasPrevious}
        onClick={onPrevious}
        leadingIcon={<ChevronLeft aria-hidden="true" />}
      >
        Previous
      </Button>
      <Button
        variant="secondary"
        size="sm"
        isDisabled={!hasNext}
        onClick={onNext}
        trailingIcon={<ChevronRight aria-hidden="true" />}
      >
        Next
      </Button>
    </nav>
  );
}

function TaskTableSkeleton() {
  return (
    <LoadingRegion label="Loading your tasks" className="space-y-2">
      <Skeleton className="h-12 w-full rounded-t-lg" />
      {[0, 1, 2, 3, 4].map((index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </LoadingRegion>
  );
}
