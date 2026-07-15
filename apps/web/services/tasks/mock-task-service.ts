import { mockTasks } from '@/mock/organization';
import { API_STATUS, type ApiCollection } from '@/types/api';
import type { Task, TaskStatus } from '@/types/domain';
import { mockError, mockRespond, mockRespondCollection } from '../http/mock-transport';
import type { TaskListQuery, TaskService, TaskSortField } from './types';

/**
 * The mock task service.
 *
 * Order of operations matters and mirrors what a real query planner does:
 * filter, then sort, then paginate. Paginating before filtering would return
 * short pages; sorting after paginating would sort only the visible page.
 */
export class MockTaskService implements TaskService {
  /** Per-instance, so a status change in one test cannot leak into another. */
  private readonly tasks: Map<string, Task>;

  constructor(seed: readonly Task[] = mockTasks) {
    this.tasks = new Map(seed.map((task) => [task.id, { ...task }]));
  }

  async list(query: TaskListQuery): Promise<ApiCollection<Task>> {
    const filtered = [...this.tasks.values()].filter((task) => matches(task, query));
    const sorted = filtered.sort(comparatorFor(query.sortBy, query.sortDirection));

    return mockRespondCollection(sorted, {
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.pageSize ? { pageSize: query.pageSize } : {}),
    });
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) {
      mockError(
        API_STATUS.NotFound,
        'task_not_found',
        'That task no longer exists.',
        'It may have been deleted or moved to another project.',
        'Refresh the list to see the current tasks.',
      );
    }

    const updated: Task = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    };
    this.tasks.set(id, updated);

    const response = await mockRespond(updated);
    return response.data;
  }
}

function matches(task: Task, query: TaskListQuery): boolean {
  // Every clause is conjunctive; an empty filter array means "no constraint".
  if (query.status.length > 0 && !query.status.includes(task.status)) return false;
  if (query.priority.length > 0 && !query.priority.includes(task.priority)) return false;
  if (query.projectId !== null && task.projectId !== query.projectId) return false;

  if (query.search) {
    // Substring, case-insensitive. Not a regex: the term comes from a URL, and
    // a user-supplied regex is a denial-of-service waiting to happen.
    if (!task.title.toLowerCase().includes(query.search.toLowerCase())) return false;
  }

  return true;
}

/**
 * A task with no due date is not "due first".
 *
 * Comparing `undefined` naively floats it to the top of an ascending sort and
 * buries whatever is actually urgent. Undated tasks always sort last, in both
 * directions — their absence of a date is not a position on the axis.
 */
function compareDueDates(a: Task, b: Task, direction: 1 | -1): number {
  if (!a.dueAt && !b.dueAt) return 0;
  if (!a.dueAt) return 1;
  if (!b.dueAt) return -1;
  return a.dueAt.localeCompare(b.dueAt) * direction;
}

function comparatorFor(
  sortBy: TaskSortField,
  sortDirection: 'asc' | 'desc',
): (a: Task, b: Task) => number {
  const direction = sortDirection === 'asc' ? 1 : -1;

  switch (sortBy) {
    case 'aiPriority':
      return (a, b) => (a.aiPriorityScore - b.aiPriorityScore) * direction;
    case 'dueAt':
      return (a, b) => compareDueDates(a, b, direction);
    case 'title':
      return (a, b) => a.title.localeCompare(b.title) * direction;
    case 'status':
      return (a, b) => a.status.localeCompare(b.status) * direction;
  }
}
