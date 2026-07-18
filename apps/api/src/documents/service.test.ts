import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { users } from '@kloyya/db/schema';
import { createTestApp, signUp } from '../test/app.js';
import type { StartContext } from '../integrations/connect.js';
import { retrieveContext } from '../ask/retrieval.js';
import {
  countDocuments,
  createDocument,
  deleteDocument,
  listDocuments,
  type NewDocument,
} from './service.js';

/**
 * Documents metadata CRUD + the fact that an uploaded document becomes something
 * Ask Kloyya can find. Storage (the bytes) is mocked away — this is the row logic:
 * it lists newest-first, counts live rows for the cap, soft-deletes, keeps each
 * workspace's files to itself, and surfaces in retrieval as its own source.
 */
let app: FastifyInstance;
let client: PGlite;
let db: AppDb;

beforeAll(async () => {
  ({ app, client, db } = await createTestApp());
});

afterAll(async () => {
  await app.close();
  await client.close();
});

async function workspace(email: string): Promise<StartContext> {
  const { userId } = await signUp(app, { email, password: 'a sufficiently long passphrase', name: 'Uploader' });
  const [profile] = await db
    .select({ orgId: users.organizationId, wsId: users.activeWorkspaceId })
    .from(users)
    .where(eq(users.id, userId));
  return { userId, workspaceId: profile!.wsId!, organizationId: profile!.orgId };
}

function doc(ctx: StartContext, over: Partial<NewDocument> = {}): NewDocument {
  return {
    name: 'notes.txt',
    mimeType: 'text/plain',
    sizeBytes: 42,
    storagePath: `${ctx.workspaceId}/some-object`,
    extractedText: 'the quarterly plan is on track',
    uploadedByUserId: ctx.userId,
    ...over,
  };
}

describe('documents service', () => {
  it('creates, lists newest-first, and counts live documents', async () => {
    const ctx = await workspace('docs-crud@kloyya.test');
    expect(await countDocuments(db, ctx)).toBe(0);

    await createDocument(db, ctx, doc(ctx, { name: 'first.txt' }));
    await createDocument(db, ctx, doc(ctx, { name: 'second.txt' }));

    const list = await listDocuments(db, ctx);
    expect(list).toHaveLength(2);
    expect(list[0]?.name).toBe('second.txt'); // newest first
    expect(list[0]?.status).toBe('ready');
    // The DTO never leaks storage path or extracted text.
    expect(list[0]).not.toHaveProperty('storagePath');
    expect(await countDocuments(db, ctx)).toBe(2);
  });

  it('soft-deletes: gone from the list and the count, path returned for cleanup', async () => {
    const ctx = await workspace('docs-delete@kloyya.test');
    const created = await createDocument(db, ctx, doc(ctx, { storagePath: 'ws/object-to-remove' }));

    const removed = await deleteDocument(db, ctx, created.id);
    expect(removed?.storagePath).toBe('ws/object-to-remove');
    expect(await listDocuments(db, ctx)).toHaveLength(0);
    expect(await countDocuments(db, ctx)).toBe(0);
    // Deleting again is a no-op — nothing live to remove.
    expect(await deleteDocument(db, ctx, created.id)).toBeNull();
  });

  it('makes an uploaded document findable by Ask Kloyya as its own source', async () => {
    const ctx = await workspace('docs-retrieval@kloyya.test');
    await createDocument(db, ctx, doc(ctx, { name: 'roadmap.txt', extractedText: 'the Q3 roadmap ships in September' }));

    const found = await retrieveContext(db, ctx, 'roadmap');
    expect(found.some((r) => r.integrationId === 'uploaded_documents' && r.label === 'roadmap.txt')).toBe(true);
  });

  it('keeps each workspace’s documents to itself', async () => {
    const a = await workspace('docs-tenant-a@kloyya.test');
    const b = await workspace('docs-tenant-b@kloyya.test');
    await createDocument(db, a, doc(a, { name: 'secret.txt' }));

    expect(await listDocuments(db, b)).toHaveLength(0);
    expect(await countDocuments(db, b)).toBe(0);
  });
});
