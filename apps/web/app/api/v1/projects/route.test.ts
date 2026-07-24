import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import type { AppDb } from '@kloyya/db/client';
import { actAs, createTestDb, createTestIdentity, resetDeps } from '@server/test/harness';
import { GET, POST } from './route';

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
  return GET(new NextRequest('http://test.local/api/v1/projects'));
}

function create(body: unknown): Promise<Response> {
  return POST(
    new NextRequest('http://test.local/api/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('GET/POST /api/v1/projects', () => {
  it('creates a project and lists it back', async () => {
    const identity = await createTestIdentity(db, { email: 'projects-route@kloyya.test' });
    switchActor(identity);

    const created = await create({ name: 'Atlas' });
    expect(created.status).toBe(200);

    const res = await list();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { projects: unknown[] } };
    expect(json.data.projects).toHaveLength(1);
  });

  it('rejects a body outside the shared vocabulary with a 422 envelope', async () => {
    const identity = await createTestIdentity(db, { email: 'projects-invalid@kloyya.test' });
    switchActor(identity);

    const res = await create({ name: 'x', status: 'not_a_status' });
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
