import { beforeEach, describe, expect, it } from 'vitest';
import { API_STATUS } from '@/types/api';
import { ApiError } from '../http/errors';
import { configureMockTransport } from '../http/mock-transport';
import { MockTaskService } from './mock-task-service';
// From the service layer, not the feature: the filter contract belongs to the
// backend, and a service must never depend on a feature module.
import { DEFAULT_TASK_FILTERS } from './types';

configureMockTransport({ instant: true, failureRate: 0 });

describe('MockTaskService', () => {
  let tasks: MockTaskService;

  beforeEach(() => {
    // A fresh instance per test: status changes must not leak between tests.
    tasks = new MockTaskService();
  });

  const list = (overrides = {}) =>
    tasks.list({ ...DEFAULT_TASK_FILTERS, pageSize: 50, ...overrides });

  describe('ordering', () => {
    it('ranks by AI priority score, descending, by default', async () => {
      const { data } = await list();
      const scores = data.map((task) => task.aiPriorityScore);

      expect(scores).toEqual([...scores].sort((a, b) => b - a));
      expect(data[0]?.title).toBe('Send revised Atlas timeline to Acme');
    });

    it('sorts by due date ascending when asked', async () => {
      const { data } = await list({ sortBy: 'dueAt', sortDirection: 'asc' });
      const dates = data.filter((t) => t.dueAt).map((t) => t.dueAt as string);

      expect(dates).toEqual([...dates].sort());
    });

    it('sorts by title alphabetically', async () => {
      const { data } = await list({ sortBy: 'title', sortDirection: 'asc' });
      const titles = data.map((task) => task.title);

      expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
    });

    it('places tasks with no due date last when sorting by due date', async () => {
      // A task with no deadline is not "due first". Sorting `undefined` naively
      // floats it to the top and buries the thing that is actually urgent.
      const { data } = await list({ sortBy: 'dueAt', sortDirection: 'asc' });
      const firstUndefined = data.findIndex((task) => !task.dueAt);

      if (firstUndefined !== -1) {
        expect(data.slice(firstUndefined).every((task) => !task.dueAt)).toBe(true);
      }
    });
  });

  describe('filtering', () => {
    it('filters by status', async () => {
      const { data } = await list({ status: ['todo'] });
      expect(data.length).toBeGreaterThan(0);
      expect(data.every((task) => task.status === 'todo')).toBe(true);
    });

    it('filters by several statuses at once', async () => {
      const { data } = await list({ status: ['todo', 'blocked'] });
      expect(data.every((task) => ['todo', 'blocked'].includes(task.status))).toBe(true);
    });

    it('filters by priority', async () => {
      const { data } = await list({ priority: ['Critical'] });
      expect(data.every((task) => task.priority === 'Critical')).toBe(true);
    });

    it('filters by project', async () => {
      const { data } = await list({ projectId: 'proj_atlas' });
      expect(data.length).toBeGreaterThan(0);
      expect(data.every((task) => task.projectId === 'proj_atlas')).toBe(true);
    });

    it('searches titles case-insensitively', async () => {
      const { data } = await list({ search: 'ATLAS' });
      expect(data.length).toBeGreaterThan(0);
      expect(data.every((task) => /atlas/i.test(task.title))).toBe(true);
    });

    it('combines filters conjunctively', async () => {
      const { data } = await list({ status: ['todo'], projectId: 'proj_atlas' });
      expect(
        data.every((task) => task.status === 'todo' && task.projectId === 'proj_atlas'),
      ).toBe(true);
    });

    it('returns an empty page, not an error, when nothing matches', async () => {
      const { data, pagination } = await list({ search: 'zzzz-no-such-task' });

      expect(data).toEqual([]);
      expect(pagination.totalCount).toBe(0);
      expect(pagination.nextCursor).toBeNull();
    });
  });

  describe('pagination', () => {
    it('paginates the filtered set, not the whole set', async () => {
      const all = await list();
      const page = await list({ pageSize: 2 });

      expect(page.data).toHaveLength(2);
      expect(page.pagination.totalCount).toBe(all.data.length);
      expect(page.pagination.nextCursor).toBeTypeOf('string');
    });
  });

  describe('updateStatus', () => {
    it('persists the new status and bumps the version', async () => {
      const { data } = await list({ status: ['todo'] });
      const target = data[0];
      if (!target) throw new Error('Fixture has no todo task.');

      const updated = await tasks.updateStatus(target.id, 'done');

      expect(updated.status).toBe('done');
      expect(updated.version).toBe(target.version + 1);
      expect(updated.updatedAt).not.toBe(target.updatedAt);
    });

    it('is visible on the next list call', async () => {
      const before = await list({ status: ['todo'] });
      const target = before.data[0];
      if (!target) throw new Error('Fixture has no todo task.');

      await tasks.updateStatus(target.id, 'done');

      const after = await list({ status: ['todo'] });
      expect(after.data.map((t) => t.id)).not.toContain(target.id);
    });

    it('rejects an unknown id with a 404 that names a recovery step', async () => {
      await expect(tasks.updateStatus('task_nope', 'done')).rejects.toBeInstanceOf(
        ApiError,
      );
      await expect(tasks.updateStatus('task_nope', 'done')).rejects.toMatchObject({
        httpStatus: API_STATUS.NotFound,
        isRetryable: false,
      });
    });
  });
});
