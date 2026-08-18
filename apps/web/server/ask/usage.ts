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

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function getAskCountToday(
  db: AppDb,
  ctx: StartContext,
  now = new Date(),
): Promise<number> {
  const day = utcDay(now);

  return withTenantScope(
    db,
    ctx.organizationId,
    async (tx) => {
      const [row] = await tx
        .select({
          count: askUsage.count,
        })
        .from(askUsage)
        .where(
          and(
            eq(
              askUsage.workspaceId,
              ctx.workspaceId,
            ),
            eq(
              askUsage.day,
              day,
            ),
          ),
        )
        .limit(1);

      return row?.count ?? 0;
    },
  );
}


export async function reserveAskCount(
  db: AppDb,
  ctx: StartContext,
  limit: number | null,
  now = new Date(),
): Promise<AskReservation> {
  const day = utcDay(now);


  if (limit === null) {
    return {
      allowed: true,
      used: 0,
      limit: null,
      day,
    };
  }


  if (limit <= 0) {
    return {
      allowed: false,
      used: 0,
      limit,
      day,
    };
  }

  return withTenantScope(
    db,
    ctx.organizationId,
    async (tx) => {
      const [row] = await tx
        .insert(askUsage)
        .values({
          organizationId:
            ctx.organizationId,

          workspaceId:
            ctx.workspaceId,

          day,

          count: 1,
        })
        .onConflictDoUpdate({
          target: [
            askUsage.workspaceId,
            askUsage.day,
          ],

          set: {
            count:
              sql`${askUsage.count} + 1`,
          },
        })
        .returning({
          count: askUsage.count,
        });

      const used =
        row?.count ?? 1;

      return {
        allowed: used <= limit,
        used,
        limit,
        day,
      };
    },
  );
}


export async function releaseAskCount(
  db: AppDb,
  ctx: StartContext,
  day: string,
): Promise<void> {
  await withTenantScope(
    db,
    ctx.organizationId,
    async (tx) => {
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
            eq(
              askUsage.workspaceId,
              ctx.workspaceId,
            ),
            eq(
              askUsage.day,
              day,
            ),
          ),
        );
    },
  );
}


export async function incrementAskCount(
  db: AppDb,
  ctx: StartContext,
  now = new Date(),
): Promise<void> {
  const day = utcDay(now);

  await withTenantScope(
    db,
    ctx.organizationId,
    async (tx) => {
      await tx
        .insert(askUsage)
        .values({
          organizationId:
            ctx.organizationId,

          workspaceId:
            ctx.workspaceId,

          day,

          count: 1,
        })
        .onConflictDoUpdate({
          target: [
            askUsage.workspaceId,
            askUsage.day,
          ],

          set: {
            count:
              sql`${askUsage.count} + 1`,
          },
        });
    },
  );
}
