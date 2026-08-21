import { beforeEach, describe, expect, it } from 'vitest';
import type { AppDb } from '@kloyya/db/client';
import { connections, syncRecords } from '@kloyya/db/schema';
import { withTenantScope } from '@kloyya/db/scope';
import type { Meeting } from '@kloyya/core';
import { createTestDb, createTestIdentity, startContextFor } from '../test/harness';
import type { StartContext } from '../tenant';
import { AiError, type AiProvider } from '../ai/provider';
import { generateMeetingBriefing, parseMeetingBriefingText } from './briefing';

/**
 * Same two failure modes the daily briefing's tests guard against: saying
 * something not actually in the workspace's data, and saying something when
 * there is no data at all — applied to one meeting instead of one morning.
 */

function stubProvider(text: string): AiProvider {
  return {
    name: 'stub',
    model: 'stub-1',
    async complete() {
      return { text };
    },
  };
}

const GOOD_REPLY = [
  'HEADLINE: Amara needs the vendor contract redlines before the call.',
  'OBJECTIVE: Agree the liability cap in section 7.',
  'TALKING POINTS:',
  '- Legal signed off on sections 2 and 4 already.',
  '- Section 7 liability cap is still open.',
  'RISKS:',
  '- Amara may push to close today, before Legal finishes review.',
].join('\n');

describe('parseMeetingBriefingText', () => {
  it('reads the labelled format, including bullet lists', () => {
    const parsed = parseMeetingBriefingText(GOOD_REPLY);
    expect(parsed?.headline).toBe('Amara needs the vendor contract redlines before the call.');
    expect(parsed?.objective).toBe('Agree the liability cap in section 7.');
    expect(parsed?.talkingPoints).toEqual([
      'Legal signed off on sections 2 and 4 already.',
      'Section 7 liability cap is still open.',
    ]);
    expect(parsed?.risks).toEqual(['Amara may push to close today, before Legal finishes review.']);
  });

  it('omits risks cleanly when the model leaves the section out', () => {
    const noRisks = [
      'HEADLINE: Routine check-in, nothing at stake.',
      'OBJECTIVE: Confirm the timeline is still on track.',
      'TALKING POINTS:',
      '- Everything shipped on schedule last sprint.',
    ].join('\n');
    const parsed = parseMeetingBriefingText(noRisks);
    expect(parsed?.talkingPoints).toEqual(['Everything shipped on schedule last sprint.']);
    expect(parsed?.risks).toEqual([]);
  });

  it('returns null without both a headline and an objective', () => {
    expect(parseMeetingBriefingText('   ')).toBeNull();
    expect(parseMeetingBriefingText('HEADLINE: only a headline')).toBeNull();
  });
});

describe('generateMeetingBriefing', () => {
  let db: AppDb;
  let ctx: StartContext;
  let connectionId: string;
  const now = new Date('2026-07-27T09:00:00.000Z');

  const meeting: Meeting = {
    id: 'evt_123',
    organizationId: '',
    workspaceId: '',
    createdBy: '',
    updatedBy: '',
    title: 'Vendor contract — Amara Osei',
    startsAt: '2026-07-27T15:00:00.000Z',
    endsAt: '2026-07-27T15:30:00.000Z',
    participants: [{ userId: 'amara@example.com', fullName: 'Amara Osei' }],
    summary: null,
    agenda: [],
    actionItems: [],
    decisions: [],
    followUps: [],
    summaryConfidence: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    version: 1,
  };

  beforeEach(async () => {
    ({ db } = await createTestDb());
    const identity = await createTestIdentity(db, { email: 'owner@example.com' });
    ctx = await startContextFor(db, identity);
    meeting.organizationId = ctx.organizationId;
    meeting.workspaceId = ctx.workspaceId;
    meeting.createdBy = ctx.userId;
    meeting.updatedBy = ctx.userId;

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

  async function land(externalId: string, payload: unknown): Promise<void> {
    await withTenantScope(db, ctx.organizationId, async (tx) => {
      await tx.insert(syncRecords).values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        connectionId,
        integrationId: 'gmail',
        resourceType: 'message',
        externalId,
        payload: payload as never,
        contentHash: externalId,
        fetchedAt: now,
      });
    });
  }

  it('says nothing when no AI provider is configured', async () => {
    await land('m1', { subject: 'Amara Osei — vendor contract redlines' });
    expect(await generateMeetingBriefing(db, ctx, null, meeting, now)).toBeNull();
  });

  it('says nothing when nothing relates to the meeting yet', async () => {
    // No landed records mention Amara or the vendor contract — an invented
    // agenda here is exactly the failure this module exists to avoid.
    expect(await generateMeetingBriefing(db, ctx, stubProvider(GOOD_REPLY), meeting, now)).toBeNull();
  });

  it('builds a briefing from records that actually relate to the meeting', async () => {
    await land('m1', { subject: 'Amara Osei — vendor contract redlines', from: 'amara@example.com' });

    const briefing = await generateMeetingBriefing(db, ctx, stubProvider(GOOD_REPLY), meeting, now);

    expect(briefing?.meetingId).toBe('evt_123');
    expect(briefing?.headline).toContain('Amara');
    expect(briefing?.talkingPoints.length).toBeGreaterThan(0);
    expect(briefing?.evidence.length).toBeGreaterThan(0);
    expect(briefing?.confidence).toBeGreaterThan(0);
  });

  it('calls the model once per meeting, then serves the stored briefing', async () => {
    await land('m1', { subject: 'Amara Osei — vendor contract redlines' });
    let calls = 0;
    const counting: AiProvider = {
      name: 'counting',
      model: 'x',
      async complete() {
        calls += 1;
        return { text: GOOD_REPLY };
      },
    };

    const first = await generateMeetingBriefing(db, ctx, counting, meeting, now);
    const second = await generateMeetingBriefing(db, ctx, counting, meeting, now);

    expect(calls).toBe(1);
    expect(second).toEqual(first);
  });

  it('returns null rather than throwing when the model host fails', async () => {
    await land('m1', { subject: 'Amara Osei — vendor contract redlines' });
    const failing: AiProvider = {
      name: 'failing',
      model: 'x',
      async complete() {
        throw new AiError('unreachable');
      },
    };
    expect(await generateMeetingBriefing(db, ctx, failing, meeting, now)).toBeNull();
  });
});
