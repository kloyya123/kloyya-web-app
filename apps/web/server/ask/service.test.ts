import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { AppDb } from '@kloyya/db/client';
import { connections, syncRecords } from '@kloyya/db/schema';
import { createTestDb, createTestIdentity, startContextFor } from '../test/harness';
import type { StartContext } from '../tenant';
import { AiError, type AiProvider } from '../ai/provider';
import { ask } from './service';

/**
 * Ask Kloyya over seeded landing-zone data. A fake provider stands in for the
 * model, capturing the prompt so we can prove the retrieved evidence actually
 * reached it — and the two "it's the model, not you" outcomes (no key, host
 * down) are asserted as the honest results they should be.
 */
let client: PGlite;
let db: AppDb;

beforeAll(async () => {
  ({ db, client } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

/** A provider that records the prompt it was handed and returns a canned reply. */
function fakeProvider(reply = 'Here is your answer.'): AiProvider & { lastUserMessage: string } {
  const state = { lastUserMessage: '' };
  return {
    name: 'openai',
    model: 'gpt-4o-mini',
    get lastUserMessage() {
      return state.lastUserMessage;
    },
    async complete(params) {
      state.lastUserMessage = params.messages[params.messages.length - 1]?.content ?? '';
      return { text: reply };
    },
  };
}

/** A provider that is configured but whose host is down. */
const brokenProvider: AiProvider = {
  name: 'openai',
  model: 'gpt-4o-mini',
  async complete() {
    throw new AiError('host down');
  },
};

async function workspaceWithRecord(email: string, payload: object): Promise<StartContext> {
  const identity = await createTestIdentity(db, { email, name: 'Asker' });
  const ctx = await startContextFor(db, identity);

  const [connection] = await db
    .insert(connections)
    .values({
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      integrationId: 'gmail',
      status: 'connected',
    })
    .returning({ id: connections.id });

  await db.insert(syncRecords).values({
    organizationId: ctx.organizationId,
    workspaceId: ctx.workspaceId,
    connectionId: connection!.id,
    integrationId: 'gmail',
    resourceType: 'message',
    externalId: 'm-1',
    payload,
    contentHash: 'hash-1',
    fetchedAt: new Date(),
  });

  return ctx;
}

describe('ask', () => {
  it('answers from connected data and cites the sources it used', async () => {
    const ctx = await workspaceWithRecord('ask-hit@kloyya.test', {
      id: 'm-1',
      subject: 'Q3 board deck',
      snippet: 'The board deck is ready for review.',
    });
    const provider = fakeProvider('The Q3 board deck is ready.');

    const outcome = await ask(db, ctx, 'board deck', provider);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.answer).toBe('The Q3 board deck is ready.');
    expect(outcome.result.model).toBe('openai:gpt-4o-mini');
    // The retrieved record became a citation with a friendly source + label.
    expect(outcome.result.citations).toHaveLength(1);
    expect(outcome.result.citations[0]).toMatchObject({ source: 'Gmail', label: 'Q3 board deck' });
    // And the evidence actually reached the model.
    expect(provider.lastUserMessage).toContain('Q3 board deck');
  });

  it('still answers (no citations) when nothing matches, telling the model so', async () => {
    const ctx = await workspaceWithRecord('ask-miss@kloyya.test', {
      id: 'm-1',
      subject: 'Lunch plans',
    });
    const provider = fakeProvider('I could not find that in your connected tools.');

    const outcome = await ask(db, ctx, 'quarterly revenue forecast', provider);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.citations).toHaveLength(0);
    expect(provider.lastUserMessage).toContain('nothing in the connected tools matched');
  });

  it('reports not_configured when no provider is available', async () => {
    const ctx = await workspaceWithRecord('ask-noai@kloyya.test', { id: 'm-1', subject: 'Anything' });
    const outcome = await ask(db, ctx, 'anything', null);
    expect(outcome).toMatchObject({ ok: false, reason: 'not_configured' });
  });

  it('reports unavailable when the model host is down', async () => {
    const ctx = await workspaceWithRecord('ask-down@kloyya.test', { id: 'm-1', subject: 'Anything' });
    const outcome = await ask(db, ctx, 'anything', brokenProvider);
    expect(outcome).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('creates a task from a command, without needing a provider at all', async () => {
    const ctx = await workspaceWithRecord('ask-task-intent@kloyya.test', { id: 'm-1', subject: 'x' });

    const outcome = await ask(db, ctx, 'create a task to review the Q3 budget', null);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.action).toMatchObject({ type: 'task_created', href: '/tasks' });
    expect(outcome.result.answer).toContain('review the Q3 budget');
  });

  it('creates a project from a command', async () => {
    const ctx = await workspaceWithRecord('ask-project-intent@kloyya.test', { id: 'm-1', subject: 'x' });

    const outcome = await ask(db, ctx, 'start a new project: Atlas Launch', null);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.action?.type).toBe('project_created');
    expect(outcome.result.action?.href).toBe(`/projects/${outcome.result.action?.id}`);
  });

  it('does not cross workspaces — one user cannot see another’s records', async () => {
    await workspaceWithRecord('ask-tenant-a@kloyya.test', {
      id: 'm-1',
      subject: 'Secret Alpha project',
    });
    const ctxB = await workspaceWithRecord('ask-tenant-b@kloyya.test', {
      id: 'm-1',
      subject: 'Unrelated Beta note',
    });
    const provider = fakeProvider();

    const outcome = await ask(db, ctxB, 'Alpha project', provider);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // B's search for A's content returns nothing — RLS + workspace scope hold.
    expect(outcome.result.citations).toHaveLength(0);
  });
});
