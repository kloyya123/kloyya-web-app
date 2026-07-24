import type { ApiCollection } from '@/types/api';
import type { Task, TaskStatus } from '@/types/domain';
import { apiFetch, apiFetchEnvelope } from '../http/transport';
import type { TaskListQuery, TaskService } from './types';

/** The real TaskService — maps one-to-one onto /v1/tasks/*. */
export class HttpTaskService implements TaskService {
  async list(query: TaskListQuery): Promise<ApiCollection<Task>> {
    const params = new URLSearchParams();
    if (query.status.length > 0) params.set('status', query.status.join(','));
    if (query.priority.length > 0) params.set('priority', query.priority.join(','));
    if (query.projectId) params.set('projectId', query.projectId);
    if (query.search) params.set('search', query.search);
    params.set('sortBy', query.sortBy);
    params.set('sortDirection', query.sortDirection);
    if (query.cursor) params.set('cursor', query.cursor);
    if (query.pageSize) params.set('pageSize', String(query.pageSize));

    const envelope = await apiFetchEnvelope<Task[]>(`/v1/tasks?${params.toString()}`);
    if (!envelope.pagination) throw new Error('Task list response had no pagination.');
    return { ...envelope, pagination: envelope.pagination };
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    return apiFetch<Task>(`/v1/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } });
  }
}
