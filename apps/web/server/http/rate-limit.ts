import { and, eq, lt, sql } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { rateLimits } from '@kloyya/db/schema';

/**
 * A fixed-window, per-subject API rate limiter, backed by Postgres.
 *
 * Vercel is stateless between invocations, so an in-memory counter would only
 * limit one lambda at a time — useless. This keeps the count in a table instead:
 * one row per (subject, window), a single upsert per request that returns the
 * new count. No Redis, on purpose — at beta scale a row-per-minute-per-user is
 * cheap and correct, and Redis is a later-stage optimization, not a launch need.
 *
 * The window is fixed (not sliding): simpler, and a fixed window's worst case is
 * a caller getting 2× the limit across a window boundary — acceptable for an
 * abuse guard whose job is stopping runaway loops, not billing-grade metering.
 *
 * It fails OPEN: if the limiter's own query throws, the request is allowed. A
 * rate limiter that takes the whole API down when the database hiccups is worse
 * than the abuse it guards against.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Requests used in the current window (after counting this one). */
  count: number;
  limit: number;
  /** Seconds until the window resets — for the Retry-After header. */
  retryAfterSeconds: number;
}

/** Test-only override so a route test can force a low limit without env wrangling. */
let testLimitOverride: number | null = null;

/** @internal test seam */
export function setRateLimitForTests(limit: number | null): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setRateLimitForTests is test-only.');
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
  const limit = testLimitOverride ?? limitPerWindow;
  // A limit of 0 disables the guard entirely.
  if (limit <= 0) {
    return { allowed: true, count: 0, limit: 0, retryAfterSeconds: 0 };
  }

  const nowSeconds = Math.floor(now.getTime() / 1000);
  const windowStart = nowSeconds - (nowSeconds % WINDOW_SECONDS);
  const retryAfterSeconds = windowStart + WINDOW_SECONDS - nowSeconds;

  try {
    const [row] = await db
      .insert(rateLimits)
      .values({ subject, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimits.subject, rateLimits.windowStart],
        set: { count: sql`${rateLimits.count} + 1` },
      })
      .returning({ count: rateLimits.count });

    // Drop this subject's stale windows — PK-indexed, so this only touches the
    // handful of rows this subject left behind, never a full-table scan.
    await db
      .delete(rateLimits)
      .where(and(eq(rateLimits.subject, subject), lt(rateLimits.windowStart, windowStart)));

    const count = row?.count ?? 1;
    return { allowed: count <= limit, count, limit, retryAfterSeconds };
  } catch {
    // Fail open — see the module comment.
    return { allowed: true, count: 0, limit, retryAfterSeconds };
  }
}
