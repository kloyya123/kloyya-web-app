import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitlist } from '@kloyya/db/schema';
import type { AppDb } from '@kloyya/db/client';
import { createTestDb } from '../test/harness';
import { addToResendAudience, joinWaitlist, normaliseEmail } from './service';

describe('normaliseEmail', () => {
  it('lower-cases and trims, so one person is one row', () => {
    expect(normaliseEmail('  Someone@Example.COM ')).toBe('someone@example.com');
  });
});

describe('joinWaitlist', () => {
  let db: AppDb;

  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('records a new address', async () => {
    const result = await joinWaitlist(db, 'first@example.com', 'landing');
    expect(result.isNew).toBe(true);

    const rows = await db.select().from(waitlist);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe('first@example.com');
    expect(rows[0]?.source).toBe('landing');
  });

  it('treats a repeat signup as the same person, not a conflict', async () => {
    await joinWaitlist(db, 'again@example.com', 'landing');
    const second = await joinWaitlist(db, 'again@example.com', 'footer');

    expect(second.isNew).toBe(false);
    // Still one row — the address is the identity.
    expect(await db.select().from(waitlist)).toHaveLength(1);
  });

  it('collapses case and whitespace variants onto one row', async () => {
    await joinWaitlist(db, 'Mixed@Example.com', 'landing');
    await joinWaitlist(db, '  mixed@example.com  ', 'landing');

    const rows = await db.select().from(waitlist);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe('mixed@example.com');
  });

  it('leaves invited_at null so "not yet contacted" is a query', async () => {
    await joinWaitlist(db, 'pending@example.com', 'landing');
    const rows = await db.select().from(waitlist);
    expect(rows[0]?.invitedAt).toBeNull();
  });
});

describe('addToResendAudience', () => {
  it('does nothing without a key or audience, rather than throwing', async () => {
    const fetchImpl = vi.fn();
    await addToResendAudience('a@example.com', { fetchImpl: fetchImpl as unknown as typeof fetch });
    await addToResendAudience('a@example.com', {
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts the normalised address to the audience', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    await addToResendAudience('  Person@Example.COM ', {
      apiKey: 'test-key',
      audienceId: 'aud_1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/audiences/aud_1/contacts');
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'person@example.com',
      unsubscribed: false,
    });
  });

  it('swallows a transport failure — the database already has the record', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(
      addToResendAudience('a@example.com', {
        apiKey: 'k',
        audienceId: 'aud_1',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toBeUndefined();
  });

  it('swallows a rejection from Resend', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 422 });
    await expect(
      addToResendAudience('a@example.com', {
        apiKey: 'k',
        audienceId: 'aud_1',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toBeUndefined();
  });
});
