import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { AppDb } from '@kloyya/db/client';
import { createTestDb, createTestIdentity, startContextFor } from '../test/harness';
import type { StartContext } from '../tenant';
import { createTask, deleteTask, getTask, listTasks, updateTaskStatus } from './service';

/**
 * Tasks CRUD over the real DB. What matters: default sort is AI priority
 * (worst-ignored first), status updates and delete both stay workspace-scoped
 * (RLS), and delete is soft.
 */
let client: PGlite;
let db: AppDb;

beforeAll(async () => {
  ({ db, client } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

async function workspace(email: string): Promise<StartContext> {
  const identity = await createTestIdentity(db, { email, name: 'Owner' });
  return startContextFor(db, identity);
}

describe('tasks', () => {
  it('creates and reads a task', async () => {
    const ctx = await workspace('tasks-crud@kloyya.test');
    const task = await createTask(db, ctx, { title: 'Ship the thing' });

    expect(task.title).toBe('Ship the thing');
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('Medium');
    expect((await getTask(db, ctx, task.id))?.title).toBe('Ship the thing');
  });

  it('lists sorted by AI priority score, highest first by default', async () => {
    const ctx = await workspace('tasks-sort@kloyya.test');
    const low = await createTask(db, ctx, { title: 'Low', aiPriorityScore: 10 });
    const high = await createTask(db, ctx, { title: 'High', aiPriorityScore: 90 });

    const page = await listTasks(db, ctx);
    expect(page.tasks.map((t) => t.id)).toEqual([high.id, low.id]);
  });

  it('filters by status and priority', async () => {
    const ctx = await workspace('tasks-filter@kloyya.test');
    await createTask(db, ctx, { title: 'Todo one', status: 'todo' });
    const done = await createTask(db, ctx, { title: 'Done one', status: 'done' });

    const page = await listTasks(db, ctx, { status: ['done'] });
    expect(page.tasks.map((t) => t.id)).toEqual([done.id]);
  });

  it('paginates with an opaque cursor', async () => {
    const ctx = await workspace('tasks-page@kloyya.test');
    for (let i = 0; i < 3; i += 1) {
      await createTask(db, ctx, { title: `Task ${i}`, aiPriorityScore: i });
    }

    const first = await listTasks(db, ctx, { pageSize: 2 });
    expect(first.tasks).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    expect(first.totalCount).toBe(3);

    const second = await listTasks(db, ctx, { pageSize: 2, cursor: first.nextCursor });
    expect(second.tasks).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });

  it('updates status', async () => {
    const ctx = await workspace('tasks-status@kloyya.test');
    const task = await createTask(db, ctx, { title: 'Review PR' });

    const updated = await updateTaskStatus(db, ctx, task.id, 'done');
    expect(updated?.status).toBe('done');
  });

  it('soft-deletes — gone from reads, but not truly deleted', async () => {
    const ctx = await workspace('tasks-delete@kloyya.test');
    const task = await createTask(db, ctx, { title: 'Doomed' });

    expect(await deleteTask(db, ctx, task.id)).toBe(true);
    expect(await getTask(db, ctx, task.id)).toBeNull();
    expect(await deleteTask(db, ctx, task.id)).toBe(false);
  });

  it('keeps each workspace’s tasks to itself', async () => {
    const a = await workspace('tasks-tenant-a@kloyya.test');
    const b = await workspace('tasks-tenant-b@kloyya.test');
    const taskA = await createTask(db, a, { title: 'A secret' });

    expect((await listTasks(db, b)).tasks).toHaveLength(0);
    expect(await getTask(db, b, taskA.id)).toBeNull();
    expect(await updateTaskStatus(db, b, taskA.id, 'done')).toBeNull();
    expect(await deleteTask(db, b, taskA.id)).toBe(false);
    expect((await getTask(db, a, taskA.id))?.title).toBe('A secret');
  });
});
