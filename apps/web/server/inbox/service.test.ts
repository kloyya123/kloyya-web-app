import { beforeEach, describe, expect, it } from 'vitest';
import type { AppDb } from '@kloyya/db/client';
import { connections, syncRecords } from '@kloyya/db/schema';
import { withTenantScope } from '@kloyya/db/scope';
import { createTestDb, createTestIdentity, startContextFor } from '../test/harness';
import type { StartContext } from '../tenant';
import { getEmailThread, getInboxList } from './service';

/**
 * The inbox replaced a service pinned to the mock regardless of
 * NEXT_PUBLIC_USE_REAL_API, so these tests care most about the same two things
 * as the dashboard's: real synced messages come back, shaped correctly, and
 * nothing is invented when there are none.
 */
describe('getInboxList', () => {
  let db: AppDb;
  let ctx: StartContext;
  let connectionId: string;
  const now = new Date('2026-07-27T09:00:00.000Z');

  beforeEach(async () => {
    ({ db } = await createTestDb());
    const identity = await createTestIdentity(db, { email: 'owner@example.com' });
    ctx = await startContextFor(db, identity);

    connectionId = await withTenantScope(db, ctx.organizationId, async (tx) => {
      const [row] = await tx
        .insert(connections)
        .values({
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId,
          integrationId: 'gmail',
          status: 'connected',
          connectedByUserId: ctx.userId,
        })
        .returning({ id: connections.id });
      return row!.id;
    });
  });

  /** Land a Gmail message exactly as syncGmail would, in the given tenant. */
  async function landMessage(
    targetDb: AppDb,
    targetCtx: StartContext,
    targetConnectionId: string,
    externalId: string,
    payload: unknown,
    fetchedAt: Date = now,
  ): Promise<void> {
    await withTenantScope(targetDb, targetCtx.organizationId, async (tx) => {
      await tx.insert(syncRecords).values({
        organizationId: targetCtx.organizationId,
        workspaceId: targetCtx.workspaceId,
        connectionId: targetConnectionId,
        integrationId: 'gmail',
        resourceType: 'message',
        externalId,
        payload,
        contentHash: `hash-${externalId}`,
        fetchedAt,
      });
    });
  }

  function gmailMessage(opts: {
    id: string;
    threadId?: string;
    subject?: string;
    from?: string;
    internalDate?: string;
    unread?: boolean;
    snippet?: string;
  }) {
    const headers: { name: string; value: string }[] = [];
    if (opts.subject !== undefined) headers.push({ name: 'Subject', value: opts.subject });
    if (opts.from !== undefined) headers.push({ name: 'From', value: opts.from });
    return {
      id: opts.id,
      threadId: opts.threadId ?? opts.id,
      labelIds: opts.unread ?? true ? ['UNREAD', 'INBOX'] : ['INBOX'],
      snippet: opts.snippet ?? '',
      internalDate: opts.internalDate ?? String(now.getTime()),
      payload: { headers },
    };
  }

  it('returns an empty inbox rather than a fixture when nothing has synced', async () => {
    const result = await getInboxList(db, ctx);
    expect(result).toEqual({ needsAttention: [], everythingElse: [], unreadCount: 0 });
  });

  it('reads a synced Gmail message', async () => {
    await landMessage(
      db,
      ctx,
      connectionId,
      'msg-1',
      gmailMessage({
        id: 'msg-1',
        subject: 'Renewal — pricing addendum',
        from: 'Priya Shah <priya@acme.com>',
        snippet: 'Here is the updated pricing for your review.',
        unread: true,
      }),
    );

    const result = await getInboxList(db, ctx);
    expect(result.unreadCount).toBe(1);
    const [thread] = result.needsAttention;
    expect(thread).toBeDefined();
    expect(thread!.subject).toBe('Renewal — pricing addendum');
    expect(thread!.senderName).toBe('Priya Shah');
    expect(thread!.senderEmail).toBe('priya@acme.com');
    expect(thread!.isUnread).toBe(true);
    expect(thread!.needsReply).toBe(true);
    // Gmail's own snippet, not a Kloyya-generated summary.
    expect(thread!.aiSummary).toBe('Here is the updated pricing for your review.');
  });

  it('places an unread message in needsAttention and a read one in everythingElse', async () => {
    await landMessage(
      db,
      ctx,
      connectionId,
      'unread-1',
      gmailMessage({ id: 'unread-1', subject: 'Please review', from: 'a@example.com', unread: true }),
    );
    await landMessage(
      db,
      ctx,
      connectionId,
      'read-1',
      gmailMessage({ id: 'read-1', subject: 'FYI', from: 'b@example.com', unread: false }),
    );

    const result = await getInboxList(db, ctx);
    expect(result.needsAttention.map((t) => t.subject)).toEqual(['Please review']);
    expect(result.everythingElse.map((t) => t.subject)).toEqual(['FYI']);
    expect(result.unreadCount).toBe(1);
  });

  it('collapses multiple messages in the same thread into one row, newest first', async () => {
    await landMessage(
      db,
      ctx,
      connectionId,
      'msg-old',
      gmailMessage({ id: 'msg-old', threadId: 'thread-1', subject: 'Original', from: 'a@example.com' }),
      new Date('2026-07-26T09:00:00.000Z'),
    );
    await landMessage(
      db,
      ctx,
      connectionId,
      'msg-new',
      gmailMessage({ id: 'msg-new', threadId: 'thread-1', subject: 'Re: Original', from: 'a@example.com' }),
      new Date('2026-07-27T09:00:00.000Z'),
    );

    const result = await getInboxList(db, ctx);
    const all = [...result.needsAttention, ...result.everythingElse];
    expect(all).toHaveLength(1);
    expect(all[0]!.subject).toBe('Re: Original');
    expect(all[0]!.id).toBe('thread-1');
  });

  it('excludes a message Gmail says is gone', async () => {
    await landMessage(
      db,
      ctx,
      connectionId,
      'msg-1',
      gmailMessage({ id: 'msg-1', subject: 'Gone', from: 'a@example.com' }),
    );
    await withTenantScope(db, ctx.organizationId, async (tx) => {
      await tx.update(syncRecords).set({ deletedAtSource: now });
    });

    const result = await getInboxList(db, ctx);
    expect(result.needsAttention).toEqual([]);
    expect(result.everythingElse).toEqual([]);
  });

  it('skips a record whose payload carries no recognizable Gmail headers', async () => {
    await landMessage(db, ctx, connectionId, 'not-gmail-shaped', { id: 'not-gmail-shaped' });
    await landMessage(
      db,
      ctx,
      connectionId,
      'good',
      gmailMessage({ id: 'good', subject: 'Readable', from: 'a@example.com' }),
    );

    const result = await getInboxList(db, ctx);
    const all = [...result.needsAttention, ...result.everythingElse];
    expect(all.map((t) => t.subject)).toEqual(['Readable']);
  });

  it('never shows one workspace’s mail to another', async () => {
    const otherIdentity = await createTestIdentity(db, { email: 'other@example.com' });
    const otherCtx = await startContextFor(db, otherIdentity);
    const otherConnectionId = await withTenantScope(db, otherCtx.organizationId, async (tx) => {
      const [row] = await tx
        .insert(connections)
        .values({
          organizationId: otherCtx.organizationId,
          workspaceId: otherCtx.workspaceId,
          integrationId: 'gmail',
          status: 'connected',
          connectedByUserId: otherCtx.userId,
        })
        .returning({ id: connections.id });
      return row!.id;
    });

    await landMessage(
      db,
      otherCtx,
      otherConnectionId,
      'their-message',
      gmailMessage({ id: 'their-message', subject: 'Not yours', from: 'x@example.com' }),
    );

    const result = await getInboxList(db, ctx);
    expect(result.needsAttention).toEqual([]);
    expect(result.everythingElse).toEqual([]);
  });
});

describe('getEmailThread', () => {
  let db: AppDb;
  let ctx: StartContext;
  let connectionId: string;
  const now = new Date('2026-07-27T09:00:00.000Z');

  beforeEach(async () => {
    ({ db } = await createTestDb());
    const identity = await createTestIdentity(db, { email: 'owner@example.com' });
    ctx = await startContextFor(db, identity);
    connectionId = await withTenantScope(db, ctx.organizationId, async (tx) => {
      const [row] = await tx
        .insert(connections)
        .values({
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId,
          integrationId: 'gmail',
          status: 'connected',
          connectedByUserId: ctx.userId,
        })
        .returning({ id: connections.id });
      return row!.id;
    });
  });

  it('returns null for an id that does not match any synced thread', async () => {
    expect(await getEmailThread(db, ctx, 'nope')).toBeNull();
  });

  it('finds a thread by its Gmail threadId', async () => {
    await withTenantScope(db, ctx.organizationId, async (tx) => {
      await tx.insert(syncRecords).values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        connectionId,
        integrationId: 'gmail',
        resourceType: 'message',
        externalId: 'msg-1',
        payload: {
          id: 'msg-1',
          threadId: 'thread-1',
          labelIds: ['INBOX'],
          snippet: 'Hi there',
          internalDate: String(now.getTime()),
          payload: { headers: [{ name: 'Subject', value: 'Hello' }, { name: 'From', value: 'a@example.com' }] },
        },
        contentHash: 'hash-msg-1',
        fetchedAt: now,
      });
    });

    const thread = await getEmailThread(db, ctx, 'thread-1');
    expect(thread?.subject).toBe('Hello');
  });
});
