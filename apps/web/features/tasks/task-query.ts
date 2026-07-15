import {
  DEFAULT_TASK_FILTERS,
  TASK_SORT_FIELDS,
  type TaskFilters,
  type TaskSortField,
} from '@/services/tasks/types';
import { PRIORITY_LEVELS, TASK_STATUSES } from '@/types/domain';

/**
 * URL ⟷ TaskFilters.
 *
 * KFA: "URL State: Search, Filters, Sorting, Pagination… URL should always
 * reflect navigation state." That buys back/forward, deep links, and shareable
 * views for free.
 *
 * It also means this module parses **untrusted input**. Anyone can type
 * `?status=<script>` or `?sort=passwordHash`. Nothing here trusts, echoes, or
 * widens on what it reads: unknown values are dropped, never passed through to
 * the service.
 *
 * The filter *shape* is owned by `services/tasks/types.ts`; this file only
 * translates. Re-exported below so components have one import.
 */
export {
  DEFAULT_TASK_FILTERS,
  TASK_SORT_FIELDS,
  type TaskFilters,
  type TaskSortField,
};

const MAX_SEARCH_LENGTH = 200;

/** Keep only values present in `allowed`, in first-seen order, without repeats. */
function pickKnown<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return [];

  const permitted = new Set<string>(allowed);
  const seen = new Set<T>();

  for (const candidate of raw.split(',')) {
    const value = candidate.trim();
    if (permitted.has(value)) seen.add(value as T);
  }
  return [...seen];
}

function isSortField(value: string | null): value is TaskSortField {
  return value !== null && (TASK_SORT_FIELDS as readonly string[]).includes(value);
}

export function parseTaskQuery(search: URLSearchParams): TaskFilters {
  const sortBy = search.get('sort');
  const sortDirection = search.get('dir');
  const projectId = search.get('project')?.trim();

  return {
    status: pickKnown(search.get('status'), TASK_STATUSES),
    priority: pickKnown(search.get('priority'), PRIORITY_LEVELS),
    // An empty `?project=` means "no filter", not "the project named ''".
    projectId: projectId ? projectId : null,
    search: (search.get('q') ?? '').trim().slice(0, MAX_SEARCH_LENGTH),
    sortBy: isSortField(sortBy) ? sortBy : DEFAULT_TASK_FILTERS.sortBy,
    sortDirection:
      sortDirection === 'asc' || sortDirection === 'desc'
        ? sortDirection
        : DEFAULT_TASK_FILTERS.sortDirection,
    // Read verbatim. The service decodes it; the UI never does.
    cursor: search.get('cursor'),
  };
}

export interface SerializeOptions {
  /**
   * Drop the cursor. A cursor is only meaningful for the query that produced it;
   * carrying it across a filter change lands the user on page three of a
   * different list.
   */
  resetCursor?: boolean;
}

/** Writes only what differs from the defaults, so a shared URL stays legible. */
export function serializeTaskQuery(
  filters: TaskFilters,
  options: SerializeOptions = {},
): URLSearchParams {
  const search = new URLSearchParams();

  if (filters.status.length > 0) search.set('status', filters.status.join(','));
  if (filters.priority.length > 0) search.set('priority', filters.priority.join(','));
  if (filters.projectId) search.set('project', filters.projectId);
  if (filters.search) search.set('q', filters.search);
  if (filters.sortBy !== DEFAULT_TASK_FILTERS.sortBy) search.set('sort', filters.sortBy);
  if (filters.sortDirection !== DEFAULT_TASK_FILTERS.sortDirection) {
    search.set('dir', filters.sortDirection);
  }
  if (filters.cursor && !options.resetCursor) search.set('cursor', filters.cursor);

  return search;
}
