import { and, eq, sql } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { withTenantScope } from '@kloyya/db/scope';
import { askUsage } from '@kloyya/db/schema';
import type { StartContext } from '../integrations/connect.js';

/**
 * The daily Ask counter.
 *
 * The Free plan caps questions per day; these two functions are what that cap
 * reads and advances. Everything is keyed by (workspace, UTC day), so the count
 * resets on its own at midnight UTC — a new day is simply a row that doesn't
 * exist yet, no cleanup required.
 */

/** The UTC calendar day, as the `date` column stores it (YYYY-MM-DD). */
function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function getAskCountToday(
  db: AppDb,
  ctx: StartContext,
  now = new Date(),
): Promise<number> {
  const day = utcDay(now);
  return withTenantScope(db, ctx.organizationId, async (tx) => {
    const [row] = await tx
      .select({ count: askUsage.count })
      .from(askUsage)
      .where(and(eq(askUsage.workspaceId, ctx.workspaceId), eq(askUsage.day, day)))
      .limit(1);
    return row?.count ?? 0;
  });
}

/** Add one to today's count, creating the row on first use. */
export async function incrementAskCount(
  db: AppDb,
  ctx: StartContext,
  now = new Date(),
): Promise<void> {
  const day = utcDay(now);
  await withTenantScope(db, ctx.organizationId, async (tx) => {
    await tx
      .insert(askUsage)
      .values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        day,
        count: 1,
      })
      .onConflictDoUpdate({
        target: [askUsage.workspaceId, askUsage.day],
        set: { count: sql`${askUsage.count} + 1` },
      });
  });
}
