import { and, asc, desc, eq, ilike, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { tasks } from '@kloyya/db/schema';
import type { PriorityLevel, TaskStatus } from '@kloyya/core';
import type { StartContext } from '../tenant';

/**
 * Tasks.
 *
 * Workspace-scoped and RLS-isolated, like every other tenant table. `priority`
 * is human-set (KDSE bands); `aiPriorityScore` is a separate AI-derived ranking,
 * never conflated with it — the default sort is by that score, worst-ignored
 * first. Delete is a soft delete (`deletedAt`), same reasoning as drafts: a task
 * you didn't mean to remove should be recoverable, not gone.
 */

export const TASK_SORT_FIELDS = ['aiPriority', 'dueAt', 'title', 'status'] as const;
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: PriorityLevel;
  ownerId: string | null;
  projectId: string | null;
  dueAt: string | null;
  aiPriorityScore: number;
  organizationId: string;
  workspaceId: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

const taskColumns = {
  id: tasks.id,
  title: tasks.title,
  status: tasks.status,
  priority: tasks.priority,
  ownerId: tasks.ownerId,
  projectId: tasks.projectId,
  dueAt: tasks.dueAt,
  aiPriorityScore: tasks.aiPriorityScore,
  organizationId: tasks.organizationId,
  workspaceId: tasks.workspaceId,
  createdBy: tasks.createdBy,
  updatedBy: tasks.updatedBy,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
  version: tasks.version,
};

type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: PriorityLevel;
  ownerId: string | null;
  projectId: string | null;
  dueAt: Date | null;
  aiPriorityScore: number;
  organizationId: string;
  workspaceId: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    ownerId: row.ownerId,
    projectId: row.projectId,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    aiPriorityScore: row.aiPriorityScore,
    organizationId: row.organizationId,
    workspaceId: row.workspaceId,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

/** The cursor is an opaque, base64-encoded offset — same scheme the mock uses,
 *  so the frontend never has to learn a real pagination scheme exists. */
function encodeCursor(offset: number): string {
  return Buffer.from(`offset:${offset}`, 'utf8').toString('base64');
}

function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8');
    const [, raw] = decoded.split(':');
    const offset = Number.parseInt(raw ?? '', 10);
    return Number.isNaN(offset) || offset < 0 ? 0 : offset;
  } catch {
    return 0;
  }
}

export interface ListTasksQuery {
  status?: TaskStatus[] | undefined;
  priority?: PriorityLevel[] | undefined;
  projectId?: string | null | undefined;
  search?: string | undefined;
  sortBy?: TaskSortField | undefined;
  sortDirection?: 'asc' | 'desc' | undefined;
  cursor?: string | null | undefined;
  pageSize?: number | undefined;
}

export interface TaskPage {
  tasks: Task[];
  nextCursor: string | null;
  previousCursor: string | null;
  totalCount: number;
}

function sortColumn(sortBy: TaskSortField) {
  switch (sortBy) {
    case 'aiPriority':
      return tasks.aiPriorityScore;
    case 'dueAt':
      return tasks.dueAt;
    case 'title':
      return tasks.title;
    case 'status':
      return tasks.status;
  }
}

export async function listTasks(
  db: AppDb,
  ctx: StartContext,
  query: ListTasksQuery = {},
): Promise<TaskPage> {
  const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 100);
  const offset = decodeCursor(query.cursor);
  const direction = query.sortDirection ?? 'desc';
  const order = direction === 'asc' ? asc : desc;
  const column = sortColumn(query.sortBy ?? 'aiPriority');

  const conditions: SQL[] = [eq(tasks.workspaceId, ctx.workspaceId), isNull(tasks.deletedAt)];
  if (query.status && query.status.length > 0) conditions.push(inArray(tasks.status, query.status));
  if (query.priority && query.priority.length > 0) {
    conditions.push(inArray(tasks.priority, query.priority));
  }
  if (query.projectId) conditions.push(eq(tasks.projectId, query.projectId));
  // Substring, case-insensitive; no regex, since the term comes from a URL.
  if (query.search) conditions.push(ilike(tasks.title, `%${query.search}%`));

  const { rows, totalCount } = await withTenantScope(db, ctx.organizationId, async (tx) => {
    const [rows, [countRow]] = await Promise.all([
      tx
        .select(taskColumns)
        .from(tasks)
        .where(and(...conditions))
        .orderBy(order(column), order(tasks.id))
        .limit(pageSize + 1)
        .offset(offset),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(and(...conditions)),
    ]);
    return { rows, totalCount: countRow?.count ?? 0 };
  });

  const hasNext = rows.length > pageSize;
  const page = rows.slice(0, pageSize);

  return {
    tasks: page.map(toTask),
    nextCursor: hasNext ? encodeCursor(offset + pageSize) : null,
    previousCursor: offset > 0 ? encodeCursor(Math.max(0, offset - pageSize)) : null,
    totalCount,
  };
}

export interface CreateTaskInput {
  title: string;
  status?: TaskStatus | undefined;
  priority?: PriorityLevel | undefined;
  ownerId?: string | null | undefined;
  projectId?: string | null | undefined;
  dueAt?: string | null | undefined;
  aiPriorityScore?: number | undefined;
}

export async function createTask(
  db: AppDb,
  ctx: StartContext,
  input: CreateTaskInput,
): Promise<Task> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .insert(tasks)
      .values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        title: input.title,
        status: input.status ?? 'todo',
        priority: input.priority ?? 'Medium',
        ownerId: input.ownerId ?? ctx.userId,
        projectId: input.projectId ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        aiPriorityScore: input.aiPriorityScore ?? 0,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning(taskColumns),
  );
  return toTask(rows[0]!);
}

export async function getTask(db: AppDb, ctx: StartContext, id: string): Promise<Task | null> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select(taskColumns)
      .from(tasks)
      .where(and(eq(tasks.workspaceId, ctx.workspaceId), eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1),
  );
  return rows[0] ? toTask(rows[0]) : null;
}

export async function updateTaskStatus(
  db: AppDb,
  ctx: StartContext,
  id: string,
  status: TaskStatus,
): Promise<Task | null> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .update(tasks)
      .set({ status, updatedBy: ctx.userId })
      .where(and(eq(tasks.workspaceId, ctx.workspaceId), eq(tasks.id, id), isNull(tasks.deletedAt)))
      .returning(taskColumns),
  );
  return rows[0] ? toTask(rows[0]) : null;
}

/** Soft delete — the row stays, filtered from every read, recoverable. */
export async function deleteTask(db: AppDb, ctx: StartContext, id: string): Promise<boolean> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .update(tasks)
      .set({ deletedAt: new Date(), updatedBy: ctx.userId })
      .where(and(eq(tasks.workspaceId, ctx.workspaceId), eq(tasks.id, id), isNull(tasks.deletedAt)))
      .returning({ id: tasks.id }),
  );
  return rows.length > 0;
}
