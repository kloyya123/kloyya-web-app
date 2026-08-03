import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppDb } from '@kloyya/db/client';
import { connections, syncRecords } from '@kloyya/db/schema';
import { withTenantScope } from '@kloyya/db/scope';
import { createTestDb, createTestIdentity, startContextFor } from '../test/harness';
import type { StartContext } from '../tenant';
import { createTokenCrypto } from '../crypto/tokens';
import type { SyncOutcome } from '../integrations/sync';
import { runScheduledSync, type Syncer } from './scheduler';

/**
 * The scheduler's own job is small — read connections, call the right syncer,
 * keep going when one fails, brief what synced — but it is the one file in the
 * codebase whose enumeration query legitimately runs outside `withTenantScope`
 * (see the comment in scheduler.ts for why). These tests exist to prove that
 * crossing the boundary once, on purpose, in one place, never lets one
 * workspace's data reach another's.
 */

const EMPTY_OUTCOME: SyncOutcome = { ok: true, fetched: 0, written: 0, tombstoned: 0, rejected: 0 };

/** A fake syncer that records every ctx it was called with and returns a fixed outcome. */
function fakeSyncer(outcome: SyncOutcome | (() => SyncOutcome)): {
  syncer: Syncer;
  calls: StartContext[];
} {
  const calls: StartContext[] = [];
  const syncer: Syncer = async (_db, _crypto, ctx) => {
    calls.push(ctx);
    return typeof outcome === 'function' ? outcome() : outcome;
  };
  return { syncer, calls };
}

async function insertConnection(
  db: AppDb,
  ctx: StartContext,
  integrationId: string,
  overrides: { status?: 'connected' | 'error' | 'paused' | 'syncing'; lastSyncedAt?: Date | null } = {},
): Promise<string> {
  const [row] = await db
    .insert(connections)
    .values({
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      integrationId,
      status: overrides.status ?? 'connected',
      connectedByUserId: ctx.userId,
      lastSyncedAt: overrides.lastSyncedAt ?? null,
    })
    .returning({ id: connections.id });
  return row!.id;
}

describe('runScheduledSync', () => {
  let db: AppDb;
  let crypto: ReturnType<typeof createTokenCrypto>;
  const now = new Date('2026-08-03T10:00:00.000Z');
  // The schedule runs once daily; STALE_AFTER_MS is just under 23 hours. These
  // two must sit on opposite sides of that line, matching the real cadence —
  // not the hourly one this used to test before Hobby-plan cron limits forced
  // a daily schedule.
  const RECENTLY_SYNCED = new Date(now.getTime() - 60 * 60 * 1000); // 1h ago: still fresh
  const OVERDUE = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25h ago: stale

  beforeEach(async () => {
    ({ db } = await createTestDb());
    crypto = createTokenCrypto(randomBytes(32).toString('base64'));
  });

  it('syncs a connection that has never synced', async () => {
    const identity = await createTestIdentity(db, { email: 'a@example.com' });
    const ctx = await startContextFor(db, identity);
    await insertConnection(db, ctx, 'gmail', { lastSyncedAt: null });

    const { syncer, calls } = fakeSyncer(EMPTY_OUTCOME);
    const summary = await runScheduledSync(db, {
      crypto,
      googleClientId: 'id',
      googleClientSecret: 'secret',
      syncers: { gmail: syncer },
      now: () => now.getTime(),
    });

    expect(summary.attempted).toBe(1);
    expect(summary.succeeded).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ organizationId: ctx.organizationId, workspaceId: ctx.workspaceId });
  });

  it('skips a connection synced recently, and picks up one that has gone stale', async () => {
    const identity = await createTestIdentity(db, { email: 'a@example.com' });
    const ctx = await startContextFor(db, identity);
    await insertConnection(db, ctx, 'gmail', { lastSyncedAt: RECENTLY_SYNCED });

    const identity2 = await createTestIdentity(db, { email: 'b@example.com' });
    const ctx2 = await startContextFor(db, identity2);
    await insertConnection(db, ctx2, 'gmail', { lastSyncedAt: OVERDUE });

    const { syncer, calls } = fakeSyncer(EMPTY_OUTCOME);
    await runScheduledSync(db, {
      crypto,
      googleClientId: 'id',
      googleClientSecret: 'secret',
      syncers: { gmail: syncer },
      now: () => now.getTime(),
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.workspaceId).toBe(ctx2.workspaceId);
  });

  it('does not touch a connection that is paused, errored, or already syncing', async () => {
    const identity = await createTestIdentity(db, { email: 'a@example.com' });
    const ctx = await startContextFor(db, identity);
    await insertConnection(db, ctx, 'gmail', { status: 'paused', lastSyncedAt: null });
    await insertConnection(db, ctx, 'google_drive', { status: 'error', lastSyncedAt: null });
    await insertConnection(db, ctx, 'notion', { status: 'syncing', lastSyncedAt: null });

    const { syncer, calls } = fakeSyncer(EMPTY_OUTCOME);
    await runScheduledSync(db, {
      crypto,
      googleClientId: 'id',
      googleClientSecret: 'secret',
      syncers: { gmail: syncer, google_drive: syncer, notion: syncer },
      now: () => now.getTime(),
    });

    expect(calls).toHaveLength(0);
  });

  it('skips Microsoft connectors when no Microsoft credentials are configured, without marking a failure', async () => {
    const identity = await createTestIdentity(db, { email: 'a@example.com' });
    const ctx = await startContextFor(db, identity);
    await insertConnection(db, ctx, 'outlook', { lastSyncedAt: null });

    const { syncer, calls } = fakeSyncer(EMPTY_OUTCOME);
    const summary = await runScheduledSync(db, {
      crypto,
      // No microsoftClientId/Secret supplied.
      syncers: { outlook: syncer },
      now: () => now.getTime(),
    });

    expect(calls).toHaveLength(0);
    expect(summary.attempted).toBe(0);
    expect(summary.failed).toBe(0);
  });

  it('needs no client credentials for Notion, whose token never expires', async () => {
    const identity = await createTestIdentity(db, { email: 'a@example.com' });
    const ctx = await startContextFor(db, identity);
    await insertConnection(db, ctx, 'notion', { lastSyncedAt: null });

    const { syncer, calls } = fakeSyncer(EMPTY_OUTCOME);
    const summary = await runScheduledSync(db, { crypto, syncers: { notion: syncer }, now: () => now.getTime() });

    expect(calls).toHaveLength(1);
    expect(summary.succeeded).toBe(1);
  });

  it('keeps syncing the rest of the run when one workspace throws', async () => {
    const bad = await createTestIdentity(db, { email: 'bad@example.com' });
    const badCtx = await startContextFor(db, bad);
    await insertConnection(db, badCtx, 'gmail', { lastSyncedAt: null });

    const good = await createTestIdentity(db, { email: 'good@example.com' });
    const goodCtx = await startContextFor(db, good);
    await insertConnection(db, goodCtx, 'gmail', { lastSyncedAt: null });

    const calls: StartContext[] = [];
    const syncer: Syncer = async (_db, _crypto, ctx) => {
      calls.push(ctx);
      if (ctx.workspaceId === badCtx.workspaceId) throw new Error('provider is on fire');
      return EMPTY_OUTCOME;
    };

    const summary = await runScheduledSync(db, {
      crypto,
      googleClientId: 'id',
      googleClientSecret: 'secret',
      syncers: { gmail: syncer },
      now: () => now.getTime(),
    });

    // Both were attempted — the throw did not stop the run.
    expect(calls).toHaveLength(2);
    expect(summary.attempted).toBe(2);
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(1);
  });

  it('counts a syncer that returns ok:false as failed, not thrown', async () => {
    const identity = await createTestIdentity(db, { email: 'a@example.com' });
    const ctx = await startContextFor(db, identity);
    await insertConnection(db, ctx, 'gmail', { lastSyncedAt: null });

    const { syncer } = fakeSyncer({ ...EMPTY_OUTCOME, ok: false, reason: 'revoked' });
    const summary = await runScheduledSync(db, {
      crypto,
      googleClientId: 'id',
      googleClientSecret: 'secret',
      syncers: { gmail: syncer },
      now: () => now.getTime(),
    });

    expect(summary.attempted).toBe(1);
    expect(summary.succeeded).toBe(0);
    expect(summary.failed).toBe(1);
  });

  it('sums written records across every connection in the run', async () => {
    const identity = await createTestIdentity(db, { email: 'a@example.com' });
    const ctx = await startContextFor(db, identity);
    await insertConnection(db, ctx, 'gmail', { lastSyncedAt: null });
    await insertConnection(db, ctx, 'google_drive', { lastSyncedAt: null });

    const gmailSyncer: Syncer = async () => ({ ...EMPTY_OUTCOME, written: 7 });
    const driveSyncer: Syncer = async () => ({ ...EMPTY_OUTCOME, written: 3 });

    const summary = await runScheduledSync(db, {
      crypto,
      googleClientId: 'id',
      googleClientSecret: 'secret',
      syncers: { gmail: gmailSyncer, google_drive: driveSyncer },
      now: () => now.getTime(),
    });

    expect(summary.written).toBe(10);
  });

  it('respects a lower connection cap than the number of stale connections', async () => {
    for (let i = 0; i < 5; i += 1) {
      const identity = await createTestIdentity(db, { email: `user${i}@example.com` });
      const ctx = await startContextFor(db, identity);
      await insertConnection(db, ctx, 'gmail', { lastSyncedAt: null });
    }

    const { syncer, calls } = fakeSyncer(EMPTY_OUTCOME);
    await runScheduledSync(db, {
      crypto,
      googleClientId: 'id',
      googleClientSecret: 'secret',
      syncers: { gmail: syncer },
      now: () => now.getTime(),
      maxConnections: 2,
    });

    expect(calls).toHaveLength(2);
  });

  it('never mixes up which workspace a connection belongs to', async () => {
    // Two workspaces, each with their own connection. If the enumeration query
    // or the ctx built from each row ever got its columns crossed, this is the
    // test that would catch it: workspace A's row must produce workspace A's
    // ctx, in the same position, every time.
    const a = await createTestIdentity(db, { email: 'a@example.com' });
    const aCtx = await startContextFor(db, a);
    await insertConnection(db, aCtx, 'gmail', { lastSyncedAt: null });

    const b = await createTestIdentity(db, { email: 'b@example.com' });
    const bCtx = await startContextFor(db, b);
    await insertConnection(db, bCtx, 'gmail', { lastSyncedAt: null });

    const { syncer, calls } = fakeSyncer(EMPTY_OUTCOME);
    await runScheduledSync(db, {
      crypto,
      googleClientId: 'id',
      googleClientSecret: 'secret',
      syncers: { gmail: syncer },
      now: () => now.getTime(),
    });

    const seenWorkspaces = calls.map((c) => c.workspaceId).sort();
    expect(seenWorkspaces).toEqual([aCtx.workspaceId, bCtx.workspaceId].sort());
    for (const call of calls) {
      if (call.workspaceId === aCtx.workspaceId) {
        expect(call.organizationId).toBe(aCtx.organizationId);
      } else {
        expect(call.organizationId).toBe(bCtx.organizationId);
      }
    }
  });

  it('briefs a workspace that synced this run, using an injected AI provider', async () => {
    const identity = await createTestIdentity(db, { email: 'a@example.com' });
    const ctx = await startContextFor(db, identity);
    const connectionId = await insertConnection(db, ctx, 'gmail', { lastSyncedAt: null });

    // The briefing reads sync_records, so land something for it to see —
    // otherwise generateBriefing's own empty-evidence rule (tested in
    // briefing/service.test.ts) correctly returns null, and this test would
    // pass for the wrong reason.
    await withTenantScope(db, ctx.organizationId, async (tx) => {
      await tx.insert(syncRecords).values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        connectionId,
        integrationId: 'gmail',
        resourceType: 'message',
        externalId: 'm1',
        payload: { subject: 'Board sync moved to Thursday' },
        contentHash: 'h1',
        fetchedAt: new Date(now.getTime() - 60_000),
      });
    });

    const { syncer } = fakeSyncer({ ...EMPTY_OUTCOME, written: 1 });
    const provider = {
      name: 'stub',
      model: 'stub-1',
      async complete() {
        return { text: 'HEADLINE: Board sync moved.\nNARRATIVE: Now Thursday.' };
      },
    };

    const summary = await runScheduledSync(db, {
      crypto,
      googleClientId: 'id',
      googleClientSecret: 'secret',
      syncers: { gmail: syncer },
      aiProvider: provider,
      now: () => now.getTime(),
    });

    expect(summary.briefed).toBe(1);
  });

  it('never briefs a workspace nothing synced for this run', async () => {
    const identity = await createTestIdentity(db, { email: 'a@example.com' });
    const ctx = await startContextFor(db, identity);
    // Fresh — not picked up by this run at all.
    await insertConnection(db, ctx, 'gmail', { lastSyncedAt: RECENTLY_SYNCED });

    let briefingCalls = 0;
    const provider = {
      name: 'stub',
      model: 'stub-1',
      async complete() {
        briefingCalls += 1;
        return { text: 'HEADLINE: x\nNARRATIVE: y' };
      },
    };

    const summary = await runScheduledSync(db, {
      crypto,
      googleClientId: 'id',
      googleClientSecret: 'secret',
      aiProvider: provider,
      now: () => now.getTime(),
    });

    expect(summary.briefed).toBe(0);
    expect(briefingCalls).toBe(0);
  });

  it('skips briefing entirely when no AI provider is configured', async () => {
    const identity = await createTestIdentity(db, { email: 'a@example.com' });
    const ctx = await startContextFor(db, identity);
    await insertConnection(db, ctx, 'gmail', { lastSyncedAt: null });

    const { syncer } = fakeSyncer({ ...EMPTY_OUTCOME, written: 1 });
    const summary = await runScheduledSync(db, {
      crypto,
      googleClientId: 'id',
      googleClientSecret: 'secret',
      syncers: { gmail: syncer },
      // aiProvider omitted entirely.
      now: () => now.getTime(),
    });

    expect(summary.briefed).toBe(0);
  });
});
