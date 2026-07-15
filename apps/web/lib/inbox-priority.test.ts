import { describe, expect, it } from 'vitest';
import type { EmailThread } from '@/types/domain';
import {
  importanceTier,
  NEEDS_ATTENTION_MIN,
  needsAttention,
  partitionInbox,
} from './inbox-priority';

function email(overrides: Partial<EmailThread> & { id: string }): EmailThread {
  return {
    organizationId: 'org',
    workspaceId: 'ws',
    createdBy: 'user',
    updatedBy: 'user',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    version: 1,
    subject: 'Subject',
    senderName: 'Sender',
    senderEmail: 's@example.com',
    receivedAt: '2026-07-01T00:00:00.000Z',
    aiSummary: 'Summary.',
    isUnread: false,
    importanceScore: 10,
    importanceReason: 'reason',
    needsReply: false,
    ...overrides,
  };
}

describe('needsAttention', () => {
  it('flags anything at or above the High band', () => {
    expect(needsAttention(email({ id: 'a', importanceScore: NEEDS_ATTENTION_MIN }))).toBe(true);
    expect(needsAttention(email({ id: 'b', importanceScore: NEEDS_ATTENTION_MIN - 1 }))).toBe(false);
  });

  it('flags a low-importance email that still awaits a reply', () => {
    expect(needsAttention(email({ id: 'c', importanceScore: 20, needsReply: true }))).toBe(true);
  });
});

describe('partitionInbox', () => {
  it('splits by attention and never loses or duplicates an email', () => {
    const emails = [
      email({ id: 'high', importanceScore: 90 }),
      email({ id: 'reply', importanceScore: 20, needsReply: true }),
      email({ id: 'low', importanceScore: 20 }),
    ];
    const { needsAttention: attn, everythingElse } = partitionInbox(emails);

    expect(attn.map((e) => e.id)).toEqual(['high', 'reply']);
    expect(everythingElse.map((e) => e.id)).toEqual(['low']);
    expect(attn.length + everythingElse.length).toBe(emails.length);
  });

  it('orders needs-attention by importance, then most-recent first', () => {
    const emails = [
      email({ id: 'mid', importanceScore: 80, receivedAt: '2026-07-05T00:00:00.000Z' }),
      email({ id: 'top', importanceScore: 96, receivedAt: '2026-07-01T00:00:00.000Z' }),
      email({ id: 'tieOld', importanceScore: 80, receivedAt: '2026-07-02T00:00:00.000Z' }),
    ];
    const { needsAttention: attn } = partitionInbox(emails);
    expect(attn.map((e) => e.id)).toEqual(['top', 'mid', 'tieOld']);
  });

  it('orders everything-else most-recent first, ignoring importance', () => {
    const emails = [
      email({ id: 'older', importanceScore: 40, receivedAt: '2026-07-01T00:00:00.000Z' }),
      email({ id: 'newer', importanceScore: 10, receivedAt: '2026-07-09T00:00:00.000Z' }),
    ];
    const { everythingElse } = partitionInbox(emails);
    expect(everythingElse.map((e) => e.id)).toEqual(['newer', 'older']);
  });

  it('does not mutate its input', () => {
    const emails = [email({ id: 'a', importanceScore: 10 }), email({ id: 'b', importanceScore: 90 })];
    const before = emails.map((e) => e.id);
    partitionInbox(emails);
    expect(emails.map((e) => e.id)).toEqual(before);
  });
});

describe('importanceTier', () => {
  it('bands the score for display', () => {
    expect(importanceTier(95)).toBe('critical');
    expect(importanceTier(80)).toBe('high');
    expect(importanceTier(40)).toBe('normal');
  });
});
