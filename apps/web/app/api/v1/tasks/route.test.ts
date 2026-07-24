import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import type { AppDb } from '@kloyya/db/client';
import { actAs, createTestDb, createTestIdentity, resetDeps } from '@server/test/harness';
import { GET, POST } from './route';

/**
 * Tasks at the route: envelope shape (KAS pagination included), guard behavior,
 * and 422 on a bad body — the same parity bar every ported vertical slice meets.
 */
let client: PGlite;
let db: AppDb;
let switchActor: (next: Awaited<ReturnType<typeof createTestIdentity>> | null) => void;

beforeAll(async () => {
  ({ db, client } = await createTestDb());
  switchActor = actAs(db, null);
});

afterAll(async () => {
  resetDeps();
  await client.close();
});

function list(): Promise<Response> {
  return GET(new NextRequest('http://test.local/api/v1/tasks'));
}

function create(body: unknown): Promise<Response> {
  return POST(
    new NextRequest('http://test.local/api/v1/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('GET/POST /api/v1/tasks', () => {
  it('creates a task and lists it back with a pagination envelope', async () => {
    const identity = await createTestIdentity(db, { email: 'tasks-route@kloyya.test' });
    switchActor(identity);

    const created = await create({ title: 'Write the report' });
    expect(created.status).toBe(200);
    const createdJson = (await created.json()) as { data: { id: string; title: string } };
    expect(createdJson.data.title).toBe('Write the report');

    const res = await list();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: unknown[]; pagination: { totalCount?: number } };
    expect(json.data).toHaveLength(1);
    expect(json.pagination.totalCount).toBe(1);
  });

  it('rejects a body outside the shared vocabulary with a 422 envelope', async () => {
    const identity = await createTestIdentity(db, { email: 'tasks-invalid@kloyya.test' });
    switchActor(identity);

    const res = await create({ title: 'x', status: 'not_a_status' });
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: { errorCode: string } };
    expect(json.error.errorCode).toBe('validation_failed');
  });

  it('requires a session — 401 with the KAS envelope', async () => {
    switchActor(null);
    const res = await list();
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: { errorCode: string } };
    expect(json.error.errorCode).toBe('unauthorized');
  });
});
