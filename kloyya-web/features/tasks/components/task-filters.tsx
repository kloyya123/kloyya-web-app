'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Button, Input, Select } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { TaskFilters as Filters } from '@/services/tasks/types';
import { DEFAULT_TASK_FILTERS } from '@/services/tasks/types';
import {
  PRIORITY_LEVELS,
  TASK_STATUSES,
  type PriorityLevel,
  type Project,
  type TaskStatus,
} from '@/types/domain';

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

export interface TaskFiltersProps {
  filters: Filters;
  onChange: (filters: Filters, options?: { resetCursor?: boolean }) => void;
  resultCount: number | undefined;
  /**
   * Passed in rather than fetched here. A filter bar has no business owning a
   * request, and these are already in the dashboard's cache.
   */
  projects: Project[];
}

export function TaskFilters({ filters, onChange, resultCount, projects }: TaskFiltersProps) {
  // The search box is the one control that must not navigate on every keystroke.
  const [searchDraft, setSearchDraft] = useState(filters.search);

  // Keep the draft in step when the URL changes from elsewhere (Back, a chip).
  useEffect(() => setSearchDraft(filters.search), [filters.search]);

  /** Any change to a filter invalidates the current page cursor. */
  const apply = (next: Partial<Filters>) =>
    onChange({ ...filters, ...next }, { resetCursor: true });

  const toggle = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const isFiltered =
    filters.status.length > 0 ||
    filters.priority.length > 0 ||
    filters.projectId !== null ||
    filters.search !== '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form
          className="min-w-56 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            apply({ search: searchDraft.trim() });
          }}
        >
          <label htmlFor="task-search" className="sr-only">
            Search tasks by title
          </label>
          <Input
            id="task-search"
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search tasks…"
            leadingIcon={<Search />}
          />
          {/* Submitting is the commit. Navigating per keystroke would push a
              history entry per character and refetch on every one. */}
          <button type="submit" className="sr-only">
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          <label htmlFor="task-project" className="text-caption text-subtle">
            Project
          </label>
          <Select
            id="task-project"
            value={filters.projectId ?? ''}
            onChange={(event) => apply({ projectId: event.target.value || null })}
            className="w-56"
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <FilterChipGroup
          legend="Status"
          options={TASK_STATUSES.map((status) => ({
            value: status,
            label: STATUS_LABEL[status],
          }))}
          selected={filters.status}
          onToggle={(value) => apply({ status: toggle(filters.status, value) })}
        />

        <FilterChipGroup
          legend="Priority"
          options={PRIORITY_LEVELS.map((priority) => ({
            value: priority,
            label: priority,
          }))}
          selected={filters.priority}
          onToggle={(value: PriorityLevel) =>
            apply({ priority: toggle(filters.priority, value) })
          }
        />

        {isFiltered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(DEFAULT_TASK_FILTERS, { resetCursor: true })}
            leadingIcon={<X aria-hidden="true" />}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      {/* Announced when the count changes, so a filter has an audible effect. */}
      <p role="status" className="text-caption text-subtle">
        {resultCount === undefined
          ? ''
          : resultCount === 1
            ? '1 task'
            : `${resultCount} tasks`}
      </p>
    </div>
  );
}

interface ChipOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Multi-select filter chips.
 *
 * Rendered as toggle buttons in a named group rather than checkboxes: the
 * pressed state is what matters, and `aria-pressed` says it without needing a
 * visible checkbox for every option.
 */
function FilterChipGroup<T extends string>({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: ChipOption<T>[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={`Filter by ${legend.toLowerCase()}`} className="flex items-center gap-2">
      <span className="text-caption text-subtle">{legend}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(option.value)}
              className="rounded-full"
            >
              <Badge
                tone={isSelected ? 'primary' : 'neutral'}
                className={cn(
                  'cursor-pointer transition-colors duration-100',
                  !isSelected && 'hover:bg-hover',
                )}
              >
                {option.label}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
