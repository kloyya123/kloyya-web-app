import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import type { AppDb } from '@kloyya/db/client';
import { actAs, createTestDb, createTestIdentity, resetDeps } from '@server/test/harness';
import { setRateLimitForTests } from '@server/http/rate-limit';
import { GET, POST } from './route';
import { DELETE as DELETE_ONE, GET as GET_ONE, PATCH as PATCH_ONE } from './[id]/route';

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

/** Proves the dynamic [id] segment is wired through kasRoute's params promise. */
function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('/api/v1/tasks/[id]', () => {
  it('reads, patches status, and deletes a task by id', async () => {
    const identity = await createTestIdentity(db, { email: 'tasks-byid@kloyya.test' });
    switchActor(identity);

    const created = await create({ title: 'Draft the memo' });
    const { data: task } = (await created.json()) as { data: { id: string } };

    const read = await GET_ONE(new NextRequest(`http://test.local/api/v1/tasks/${task.id}`), params(task.id));
    expect(read.status).toBe(200);

    const patched = await PATCH_ONE(
      new NextRequest(`http://test.local/api/v1/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      }),
      params(task.id),
    );
    expect(patched.status).toBe(200);
    expect(((await patched.json()) as { data: { status: string } }).data.status).toBe('done');

    const removed = await DELETE_ONE(new NextRequest(`http://test.local/api/v1/tasks/${task.id}`), params(task.id));
    expect(removed.status).toBe(200);

    const gone = await GET_ONE(new NextRequest(`http://test.local/api/v1/tasks/${task.id}`), params(task.id));
    expect(gone.status).toBe(404);
  });

  it('404s an unknown id', async () => {
    const identity = await createTestIdentity(db, { email: 'tasks-missing@kloyya.test' });
    switchActor(identity);

    const id = '00000000-0000-0000-0000-000000000000';
    const res = await GET_ONE(new NextRequest(`http://test.local/api/v1/tasks/${id}`), params(id));
    expect(res.status).toBe(404);
  });
});

describe('per-user API rate limit', () => {
  it('returns 429 with Retry-After once the caller exceeds the window limit', async () => {
    const identity = await createTestIdentity(db, { email: 'tasks-ratelimit@kloyya.test' });
    switchActor(identity);
    setRateLimitForTests(2);

    try {
      expect((await list()).status).toBe(200);
      expect((await list()).status).toBe(200);

      const limited = await list();
      expect(limited.status).toBe(429);
      expect(limited.headers.get('retry-after')).toBeTruthy();
      const json = (await limited.json()) as { error: { errorCode: string } };
      expect(json.error.errorCode).toBe('rate_limited');
    } finally {
      setRateLimitForTests(null);
    }
  });
});
