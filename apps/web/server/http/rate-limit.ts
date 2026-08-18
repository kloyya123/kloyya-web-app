import { and, eq, lt, sql } from 'drizzle-orm';

import type { AppDb } from '@kloyya/db/client';
import { rateLimits } from '@kloyya/db/schema';

export interface RateLimitResult {
  allowed: boolean;


  count: number;

  limit: number;

 
  retryAfterSeconds: number;

  degraded: boolean;
}


let testLimitOverride: number | null = null;


export function setRateLimitForTests(
  limit: number | null,
): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'setRateLimitForTests is test-only.',
    );
  }

  testLimitOverride = limit;
}

const WINDOW_SECONDS = 60;


export async function checkRateLimit(
  db: AppDb,
  subject: string,
  limitPerWindow: number,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const limit =
    testLimitOverride ?? limitPerWindow;


  if (limit <= 0) {
    return {
      allowed: true,
      count: 0,
      limit: 0,
      retryAfterSeconds: 0,
      degraded: false,
    };
  }

  const nowSeconds = Math.floor(
    now.getTime() / 1000,
  );

  const windowStart =
    nowSeconds -
    (nowSeconds % WINDOW_SECONDS);

  const retryAfterSeconds =
    windowStart +
    WINDOW_SECONDS -
    nowSeconds;

  try {
    const [row] = await db
      .insert(rateLimits)
      .values({
        subject,
        windowStart,
        count: 1,
      })
      .onConflictDoUpdate({
        target: [
          rateLimits.subject,
          rateLimits.windowStart,
        ],
        set: {
          count:
            sql`${rateLimits.count} + 1`,
        },
      })
      .returning({
        count: rateLimits.count,
      });


    await db
      .delete(rateLimits)
      .where(
        and(
          eq(
            rateLimits.subject,
            subject,
          ),
          lt(
            rateLimits.windowStart,
            windowStart,
          ),
        ),
      );

    const count = row?.count ?? 1;

    return {
      allowed: count <= limit,
      count,
      limit,
      retryAfterSeconds,
      degraded: false,
    };
  } catch {

    return {
      allowed: false,
      count: 0,
      limit,
      retryAfterSeconds,
      degraded: true,
    };
  }
}
