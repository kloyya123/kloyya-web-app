import { and, eq, sql } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { askUsage } from '@kloyya/db/schema';
import type { StartContext } from '../integrations/connect';

export interface AskReservation {
  allowed: boolean;
  used: number;
  limit: number | null;
  day: string;
}

/**
 * Return the current UTC calendar day.
 *
 * The database stores the day as YYYY-MM-DD.
 */
function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Read today's Ask usage.
 */
export async function getAskCountToday(
  db: AppDb,
  ctx: StartContext,
  now = new Date(),
): Promise<number> {
  const day = utcDay(now);

  return withTenantScope(db, ctx.organizationId, async (tx) => {
    const [row] = await tx
      .select({
        count: askUsage.count,
      })
      .from(askUsage)
      .where(
        and(
          eq(askUsage.workspaceId, ctx.workspaceId),
          eq(askUsage.day, day),
        ),
      )
      .limit(1);

    return row?.count ?? 0;
  });
}

/**
 * Reserve one Ask request atomically.
 *
 * This is intentionally done BEFORE calling the AI provider.
 *
 * Without an atomic reservation:
 *
 * Request A -> sees 9/10
 * Request B -> sees 9/10
 * Request A -> allowed
 * Request B -> allowed
 *
 * The user could therefore consume more than the plan allows.
 *
 * With this function, PostgreSQL performs the increment
 * atomically and we check the resulting value.
 *
 * `limit === null` represents an unlimited (e.g. Pro) plan and
 * always succeeds without touching the usage row.
 */
export async function reserveAskCount(
  db: AppDb,
  ctx: StartContext,
  limit: number | null,
  now = new Date(),
): Promise<AskReservation> {
  const day = utcDay(now);

  // Pro / unlimited.
  if (limit === null) {
    return {
      allowed: true,
      used: 0,
      limit: null,
      day,
    };
  }

  // No questions allowed.
  if (limit <= 0) {
    return {
      allowed: false,
      used: 0,
      limit,
      day,
    };
  }

  return withTenantScope(db, ctx.organizationId, async (tx) => {
    const [row] = await tx
      .insert(askUsage)
      .values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        day,
        count: 1,
      })
      .onConflictDoUpdate({
        target: [askUsage.workspaceId, askUsage.day],
        // Atomic increment. PostgreSQL evaluates this expression
        // against the current database value.
        set: {
          count: sql`${askUsage.count} + 1`,
        },
      })
      .returning({
        count: askUsage.count,
      });

    const used = row?.count ?? 1;

    return {
      allowed: used <= limit,
      used,
      limit,
      day,
    };
  });
}

/**
 * Refund a reservation when the AI provider fails.
 *
 * We never let a failed Perplexity request permanently
 * consume a user's daily Ask quota.
 */
export async function releaseAskCount(
  db: AppDb,
  ctx: StartContext,
  day: string,
): Promise<void> {
  await withTenantScope(db, ctx.organizationId, async (tx) => {
    await tx
      .update(askUsage)
      .set({
        count: sql`
          GREATEST(
            ${askUsage.count} - 1,
            0
          )
        `,
      })
      .where(
        and(
          eq(askUsage.workspaceId, ctx.workspaceId),
          eq(askUsage.day, day),
        ),
      );
  });
}

/**
 * Legacy helper kept for compatibility with
 * existing code/tests.
 */
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
        set: {
          count: sql`${askUsage.count} + 1`,
        },
      });
  });
}
