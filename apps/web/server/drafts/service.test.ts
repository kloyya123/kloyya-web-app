import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { AppDb } from '@kloyya/db/client';
import { createTestDb, createTestIdentity, startContextFor } from '../test/harness';
import type { StartContext } from '../tenant';
import { createDraft, deleteDraft, getDraft, listDrafts, updateDraft } from './service';

/**
 * Drafts CRUD over the real DB. What matters: autosave is a patch (only changed
 * fields move), delete is soft (filtered from reads, not gone), and one
 * workspace can never touch another's drafts (RLS).
 */
let client: PGlite;
let db: AppDb;

beforeAll(async () => {
  ({ db, client } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

async function workspace(email: string): Promise<StartContext> {
  const identity = await createTestIdentity(db, { email, name: 'Writer' });
  return startContextFor(db, identity);
}

describe('drafts', () => {
  it('creates, reads, and lists newest-first', async () => {
    const ctx = await workspace('drafts-crud@kloyya.test');

    const first = await createDraft(db, ctx, { type: 'email', title: 'Reply to Sam' });
    const second = await createDraft(db, ctx, { type: 'note', title: 'Standup notes' });

    expect(first.type).toBe('email');
    expect((await getDraft(db, ctx, first.id))?.title).toBe('Reply to Sam');

    const list = await listDrafts(db, ctx);
    // Newest first — second was created last.
    expect(list.map((d) => d.id)).toEqual([second.id, first.id]);
  });

  it('autosaves as a patch — only the fields sent change', async () => {
    const ctx = await workspace('drafts-autosave@kloyya.test');
    const draft = await createDraft(db, ctx, { type: 'note', title: 'Title', body: 'first' });

    const saved = await updateDraft(db, ctx, draft.id, { body: 'second pass' });
    expect(saved?.title).toBe('Title'); // untouched
    expect(saved?.body).toBe('second pass');
  });

  it('archives without deleting, and lists by status', async () => {
    const ctx = await workspace('drafts-archive@kloyya.test');
    const draft = await createDraft(db, ctx, { type: 'report', title: 'Q3' });

    await updateDraft(db, ctx, draft.id, { status: 'archived' });

    expect(await listDrafts(db, ctx, { status: 'active' })).toHaveLength(0);
    expect((await listDrafts(db, ctx, { status: 'archived' })).map((d) => d.id)).toEqual([draft.id]);
  });

  it('soft-deletes — gone from reads, but not truly deleted', async () => {
    const ctx = await workspace('drafts-delete@kloyya.test');
    const draft = await createDraft(db, ctx, { type: 'note', title: 'Doomed' });

    expect(await deleteDraft(db, ctx, draft.id)).toBe(true);
    expect(await getDraft(db, ctx, draft.id)).toBeNull();
    expect(await listDrafts(db, ctx)).toHaveLength(0);
    // Deleting again finds nothing to delete.
    expect(await deleteDraft(db, ctx, draft.id)).toBe(false);
  });

  it('keeps each workspace’s drafts to itself', async () => {
    const a = await workspace('drafts-tenant-a@kloyya.test');
    const b = await workspace('drafts-tenant-b@kloyya.test');
    const draftA = await createDraft(db, a, { type: 'note', title: 'A secret' });

    // B cannot see it, read it, patch it, or delete it.
    expect(await listDrafts(db, b)).toHaveLength(0);
    expect(await getDraft(db, b, draftA.id)).toBeNull();
    expect(await updateDraft(db, b, draftA.id, { title: 'hijacked' })).toBeNull();
    expect(await deleteDraft(db, b, draftA.id)).toBe(false);
    // And A's draft is untouched.
    expect((await getDraft(db, a, draftA.id))?.title).toBe('A secret');
  });
});
