import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { AppDb } from '@kloyya/db/client';
import { createTestDb } from '../test/harness';
import { checkRateLimit } from './rate-limit';

/**
 * The Postgres-backed fixed-window limiter: it counts per subject, blocks past
 * the limit, keeps subjects independent, and resets in a new window.
 */
let client: PGlite;
let db: AppDb;

beforeAll(async () => {
  ({ db, client } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

describe('checkRateLimit', () => {
  it('allows up to the limit, then blocks', async () => {
    const now = new Date('2026-07-24T10:00:00Z');
    const first = await checkRateLimit(db, 'user:a', 3, now);
    expect(first).toMatchObject({ allowed: true, count: 1, limit: 3 });

    await checkRateLimit(db, 'user:a', 3, now);
    const third = await checkRateLimit(db, 'user:a', 3, now);
    expect(third).toMatchObject({ allowed: true, count: 3 });

    const fourth = await checkRateLimit(db, 'user:a', 3, now);
    expect(fourth.allowed).toBe(false);
    expect(fourth.count).toBe(4);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keeps subjects independent', async () => {
    const now = new Date('2026-07-24T11:00:00Z');
    await checkRateLimit(db, 'user:b', 1, now);
    const bBlocked = await checkRateLimit(db, 'user:b', 1, now);
    expect(bBlocked.allowed).toBe(false);

    const cAllowed = await checkRateLimit(db, 'user:c', 1, now);
    expect(cAllowed.allowed).toBe(true);
  });

  it('resets in a new window', async () => {
    const first = new Date('2026-07-24T12:00:30Z');
    await checkRateLimit(db, 'user:d', 1, first);
    expect((await checkRateLimit(db, 'user:d', 1, first)).allowed).toBe(false);

    // A minute later is a fresh window — the count starts over.
    const later = new Date('2026-07-24T12:01:05Z');
    const fresh = await checkRateLimit(db, 'user:d', 1, later);
    expect(fresh).toMatchObject({ allowed: true, count: 1 });
  });

  it('disables the guard when the limit is 0', async () => {
    const now = new Date('2026-07-24T13:00:00Z');
    for (let i = 0; i < 5; i += 1) {
      expect((await checkRateLimit(db, 'user:e', 0, now)).allowed).toBe(true);
    }
  });
});
