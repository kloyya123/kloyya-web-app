import type { ApiCollection } from '@/types/api';
import type { PriorityLevel, Task, TaskStatus } from '@/types/domain';

/**
 * The task query contract.
 *
 * It lives in the service layer, not in the feature, because it describes what
 * the *backend* accepts. `features/tasks/task-query.ts` translates a URL into
 * this shape; it does not define it. A service that imported a feature would
 * invert the dependency KFA specifies.
 */

/** Columns a caller may sort by. A closed set, so an unknown value is rejected. */
export const TASK_SORT_FIELDS = ['aiPriority', 'dueAt', 'title', 'status'] as const;
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export interface TaskFilters {
  /** Empty means "every status". */
  status: TaskStatus[];
  priority: PriorityLevel[];
  projectId: string | null;
  search: string;
  sortBy: TaskSortField;
  sortDirection: 'asc' | 'desc';
  /** Opaque cursor. The service decodes it; nothing above the service may. */
  cursor: string | null;
}

/**
 * Ranked by Kloyya, not by deadline.
 *
 * KDA models `aiPriorityScore` separately from the human-set `priority`, and the
 * distinction is the feature: a task due next week outranks one due tomorrow
 * when a customer renewal depends on it.
 */
export const DEFAULT_TASK_FILTERS: TaskFilters = {
  status: [],
  priority: [],
  projectId: null,
  search: '',
  sortBy: 'aiPriority',
  sortDirection: 'desc',
  cursor: null,
};

export interface TaskListQuery extends TaskFilters {
  pageSize?: number;
}

export interface TaskService {
  list(query: TaskListQuery): Promise<ApiCollection<Task>>;
  /** Throws 404 when the task no longer exists. */
  updateStatus(id: string, status: TaskStatus): Promise<Task>;
}
