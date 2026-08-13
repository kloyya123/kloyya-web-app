import { beforeEach, describe, expect, it } from 'vitest';
import type { AppDb } from '@kloyya/db/client';
import { documents } from '@kloyya/db/schema';
import { withTenantScope } from '@kloyya/db/scope';
import { createTestDb, createTestIdentity, startContextFor } from '../test/harness';
import type { StartContext } from '../tenant';
import type { AiProvider } from '../ai/provider';
import { listArticles } from './service';

/**
 * `listArticles` generates AI summaries read-through, on the fly, for any
 * document that doesn't have one cached yet — a real, slow model call per
 * document (see the module doc and MAX_SUMMARIES_PER_LIST_CALL). A workspace
 * with several freshly uploaded documents must not summarize all of them in
 * one request, or the request runs well past the route's own `maxDuration`.
 */
describe('listArticles', () => {
  let db: AppDb;
  let ctx: StartContext;

  beforeEach(async () => {
    ({ db } = await createTestDb());
    const identity = await createTestIdentity(db, { email: 'owner@example.com' });
    ctx = await startContextFor(db, identity);

    await withTenantScope(db, ctx.organizationId, async (tx) => {
      await tx.insert(documents).values([
        {
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId,
          uploadedByUserId: ctx.userId,
          name: 'first.txt',
          mimeType: 'text/plain',
          sizeBytes: 100,
          storagePath: 'x/first.txt',
          extractedText: 'The first document has real content to summarize.',
          status: 'ready',
        },
        {
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId,
          uploadedByUserId: ctx.userId,
          name: 'second.txt',
          mimeType: 'text/plain',
          sizeBytes: 100,
          storagePath: 'x/second.txt',
          extractedText: 'The second document also has real content to summarize.',
          status: 'ready',
        },
      ]);
    });
  });

  it('generates at most one summary per call, leaving the rest on the excerpt fallback', async () => {
    let calls = 0;
    const provider: AiProvider = {
      name: 'stub',
      model: 'stub-1',
      async complete() {
        calls += 1;
        return { text: `Real summary #${calls}` };
      },
    };

    const first = await listArticles(db, ctx, provider);
    expect(calls).toBe(1);
    const generated = first.articles.filter((a) => a.confidence === 80);
    const fallback = first.articles.filter((a) => a.confidence === 20);
    expect(generated).toHaveLength(1);
    expect(fallback).toHaveLength(1);

    // The next call picks up where the last one left off — the previously
    // capped document gets its real summary now, without re-summarizing the
    // one already cached.
    const second = await listArticles(db, ctx, provider);
    expect(calls).toBe(2);
    expect(second.articles.every((a) => a.confidence === 80)).toBe(true);
  });

  it('never calls the model when no provider is configured', async () => {
    const list = await listArticles(db, ctx, null);
    expect(list.articles.every((a) => a.confidence === 20)).toBe(true);
  });
});
