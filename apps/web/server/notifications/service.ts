import { and, desc, eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { notifications } from '@kloyya/db/schema';
import type { NotificationCategory } from '@kloyya/core';
import type { StartContext } from '../tenant';

/**
 * Notifications.
 *
 * Workspace-wide, not per-user — matches the frontend's `AppNotification`
 * (no `userId` field) and the mock store it replaces. Ranked by decision
 * score, not `createdAt`, per KDSE: a Critical alert from an hour ago
 * outranks a routine one from a minute ago.
 */

export interface Notification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string | null;
  decisionScore: number;
  isRead: boolean;
  createdAt: string;
}

const notificationColumns = {
  id: notifications.id,
  category: notifications.category,
  title: notifications.title,
  body: notifications.body,
  href: notifications.href,
  decisionScore: notifications.decisionScore,
  isRead: notifications.isRead,
  createdAt: notifications.createdAt,
};

type NotificationRow = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string | null;
  decisionScore: number;
  isRead: boolean;
  createdAt: Date;
};

function toNotification(row: NotificationRow): Notification {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

/** Ranked by decision score, highest first — the ranking is the service's job. */
export async function listNotifications(db: AppDb, ctx: StartContext): Promise<Notification[]> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select(notificationColumns)
      .from(notifications)
      .where(eq(notifications.workspaceId, ctx.workspaceId))
      .orderBy(desc(notifications.decisionScore), desc(notifications.createdAt)),
  );
  return rows.map(toNotification);
}

export async function markNotificationRead(
  db: AppDb,
  ctx: StartContext,
  id: string,
): Promise<Notification | null> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.workspaceId, ctx.workspaceId), eq(notifications.id, id)))
      .returning(notificationColumns),
  );
  return rows[0] ? toNotification(rows[0]) : null;
}

/** Marks every unread notification in the workspace read. Returns how many changed. */
export async function markAllNotificationsRead(db: AppDb, ctx: StartContext): Promise<number> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.workspaceId, ctx.workspaceId), eq(notifications.isRead, false)))
      .returning({ id: notifications.id }),
  );
  return rows.length;
}

export interface CreateNotificationInput {
  organizationId: string;
  workspaceId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href?: string | null | undefined;
  decisionScore: number;
}

/**
 * Inserts a notification row. Callers outside a request (the sync scheduler,
 * briefing generation) already know their own org/workspace, so this takes
 * them directly rather than a `StartContext` — there is no caller identity to
 * derive one from in a cron job.
 *
 * Push delivery is a separate step (see ./push.ts) — this only writes the row
 * every in-app surface (bell, notifications page) reads.
 */
export async function createNotification(
  db: AppDb,
  input: CreateNotificationInput,
): Promise<Notification> {
  const rows = await withTenantScope(db, input.organizationId, async (tx) =>
    tx
      .insert(notifications)
      .values({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        category: input.category,
        title: input.title,
        body: input.body,
        href: input.href ?? null,
        decisionScore: input.decisionScore,
      })
      .returning(notificationColumns),
  );
  return toNotification(rows[0]!);
}
