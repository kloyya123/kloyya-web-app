import { beforeEach, describe, expect, it } from 'vitest';
import type { AppDb } from '@kloyya/db/client';
import { connections, syncRecords, tasks } from '@kloyya/db/schema';
import { withTenantScope } from '@kloyya/db/scope';
import { createTestDb, createTestIdentity, startContextFor } from '../test/harness';
import type { StartContext } from '../tenant';
import { getDashboard } from './service';

/**
 * The dashboard replaced a mock that showed every user the same demo fixture,
 * so these tests care most about two things: that real rows come back, and that
 * nothing is invented when there are none.
 */
describe('getDashboard', () => {
  let db: AppDb;
  let ctx: StartContext;
  let connectionId: string;
  const now = new Date('2026-07-27T09:00:00.000Z');

  beforeEach(async () => {
    ({ db } = await createTestDb());
    const identity = await createTestIdentity(db, { email: 'owner@example.com' });
    ctx = await startContextFor(db, identity);

    // sync_records hangs off a connection, so the fixture needs the same row a
    // real connector would have created before landing anything.
    connectionId = await withTenantScope(db, ctx.organizationId, async (tx) => {
      const [row] = await tx
        .insert(connections)
        .values({
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId,
          integrationId: 'google_calendar',
          status: 'connected',
          connectedByUserId: ctx.userId,
        })
        .returning({ id: connections.id });
      return row!.id;
    });
  });

  /** Land a calendar event exactly as a connector would. */
  async function landEvent(externalId: string, payload: unknown): Promise<void> {
    await withTenantScope(db, ctx.organizationId, async (tx) => {
      await tx.insert(syncRecords).values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        connectionId,
        integrationId: 'google_calendar',
        resourceType: 'calendar_event',
        externalId,
        payload,
        // Real syncs hash the payload to detect no-op updates; any stable
        // value works here, the dashboard never reads it.
        contentHash: `hash-${externalId}`,
        fetchedAt: now,
      });
    });
  }

  it('returns an empty dashboard rather than a fixture when nothing is connected', async () => {
    const result = await getDashboard(db, ctx, now);

    expect(result.priorities).toEqual([]);
    expect(result.upcomingMeetings).toEqual([]);
    expect(result.briefing).toBeNull();
    expect(result.recommendations).toEqual([]);
    expect(result.metrics.openTasks).toBe(0);
    expect(result.metrics.meetingsToday).toBe(0);
  });

  it('returns the workspace’s own open tasks, highest AI priority first', async () => {
    await withTenantScope(db, ctx.organizationId, async (tx) => {
      await tx.insert(tasks).values([
        {
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId,
          title: 'Low priority',
          ownerId: ctx.userId,
          createdBy: ctx.userId,
          aiPriorityScore: 20,
        },
        {
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId,
          title: 'Urgent',
          ownerId: ctx.userId,
          createdBy: ctx.userId,
          aiPriorityScore: 95,
        },
        {
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId,
          title: 'Already finished',
          ownerId: ctx.userId,
          createdBy: ctx.userId,
          status: 'done',
          aiPriorityScore: 99,
        },
      ]);
    });

    const result = await getDashboard(db, ctx, now);
    const titles = result.priorities.map((t) => (t as { title: string }).title);

    expect(titles).toEqual(['Urgent', 'Low priority']);
    // A completed task is neither a priority nor an open task.
    expect(titles).not.toContain('Already finished');
    expect(result.metrics.openTasks).toBe(2);
  });

  it('reads a Google Calendar event', async () => {
    await landEvent('evt-google', {
      summary: 'Board sync',
      start: { dateTime: '2026-07-27T10:00:00.000Z' },
      end: { dateTime: '2026-07-27T11:00:00.000Z' },
      attendees: [{ displayName: 'Dana Whitfield', email: 'dana@example.com' }],
    });

    const result = await getDashboard(db, ctx, now);
    expect(result.upcomingMeetings).toHaveLength(1);

    const meeting = result.upcomingMeetings[0]!;
    expect(meeting.title).toBe('Board sync');
    expect(meeting.startsAt).toBe('2026-07-27T10:00:00.000Z');
    expect(meeting.participants).toEqual([
      { userId: 'dana@example.com', fullName: 'Dana Whitfield' },
    ]);
    // Kloyya does not summarise meetings yet; null says so honestly.
    expect(meeting.summary).toBeNull();
  });

  it('reads an event that names its fields differently than Google does', async () => {
    await landEvent('evt-graph', {
      subject: 'Vendor call',
      start: { dateTime: '2026-07-27T12:00:00.000Z', timeZone: 'UTC' },
      end: { dateTime: '2026-07-27T12:30:00.000Z', timeZone: 'UTC' },
      attendees: [{ emailAddress: { name: 'Amara Osei', address: 'amara@example.com' } }],
    });

    const result = await getDashboard(db, ctx, now);
    const meeting = result.upcomingMeetings[0]!;

    expect(meeting.title).toBe('Vendor call');
    expect(meeting.participants).toEqual([
      { userId: 'amara@example.com', fullName: 'Amara Osei' },
    ]);
  });

  it('excludes events outside the window and orders the rest by start time', async () => {
    await landEvent('past', {
      summary: 'Yesterday',
      start: { dateTime: '2026-07-26T10:00:00.000Z' },
      end: { dateTime: '2026-07-26T11:00:00.000Z' },
    });
    await landEvent('far', {
      summary: 'Next week',
      start: { dateTime: '2026-08-03T10:00:00.000Z' },
      end: { dateTime: '2026-08-03T11:00:00.000Z' },
    });
    await landEvent('later-today', {
      summary: 'This afternoon',
      start: { dateTime: '2026-07-27T15:00:00.000Z' },
      end: { dateTime: '2026-07-27T16:00:00.000Z' },
    });
    await landEvent('soon', {
      summary: 'In an hour',
      start: { dateTime: '2026-07-27T10:00:00.000Z' },
      end: { dateTime: '2026-07-27T11:00:00.000Z' },
    });

    const result = await getDashboard(db, ctx, now);
    expect(result.upcomingMeetings.map((m) => m.title)).toEqual([
      'In an hour',
      'This afternoon',
    ]);
  });

  it('skips a malformed event instead of rendering an invalid date', async () => {
    await landEvent('broken-time', { summary: 'No start time' });
    await landEvent('broken-title', { start: { dateTime: '2026-07-27T10:00:00.000Z' } });
    await landEvent('unparseable', {
      summary: 'Bad date',
      start: { dateTime: 'not-a-date' },
    });
    await landEvent('good', {
      summary: 'Fine',
      start: { dateTime: '2026-07-27T10:00:00.000Z' },
      end: { dateTime: '2026-07-27T11:00:00.000Z' },
    });

    const result = await getDashboard(db, ctx, now);
    expect(result.upcomingMeetings.map((m) => m.title)).toEqual(['Fine']);
  });

  it('assumes an hour when an event carries no end time', async () => {
    await landEvent('all-day', {
      summary: 'All-day offsite',
      start: { date: '2026-07-27T09:30:00.000Z' },
    });

    const result = await getDashboard(db, ctx, now);
    const meeting = result.upcomingMeetings[0]!;
    expect(
      new Date(meeting.endsAt).getTime() - new Date(meeting.startsAt).getTime(),
    ).toBe(3_600_000);
  });

  it('ignores an event the provider has cancelled', async () => {
    await landEvent('cancelled', {
      summary: 'Cancelled meeting',
      start: { dateTime: '2026-07-27T10:00:00.000Z' },
      end: { dateTime: '2026-07-27T11:00:00.000Z' },
    });
    await withTenantScope(db, ctx.organizationId, async (tx) => {
      await tx.update(syncRecords).set({ deletedAtSource: now });
    });

    const result = await getDashboard(db, ctx, now);
    expect(result.upcomingMeetings).toEqual([]);
  });
});
