import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import type { AppDb } from '@kloyya/db/client';
import {
  actAs,
  createTestDb,
  createTestIdentity,
  resetDeps,
} from '@server/test/harness';
import { POST } from './route';
import { GET } from './summary/route';

/**
 * The feedback endpoints, proven at the route — the first vertical slice of the
 * API living inside Next.js. What matters here is parity with the retired
 * Fastify contract: the same KAS envelopes, the same guard behavior (401 when
 * unauthenticated, 403 with `email_not_verified` when unproven), the same 422
 * on a bad body.
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

function post(body: unknown): Promise<Response> {
  return POST(
    new NextRequest('http://test.local/api/v1/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

function summary(): Promise<Response> {
  return GET(new NextRequest('http://test.local/api/v1/feedback/summary'));
}

describe('POST /api/v1/feedback', () => {
  it('records feedback and returns a KAS receipt envelope', async () => {
    const identity = await createTestIdentity(db, { email: 'route-submit@kloyya.test' });
    switchActor(identity);

    const res = await post({ type: 'feature_request', title: 'Dark mode', body: 'please', category: 'design' });

    expect(res.status).toBe(200);
    expect(res.headers.get('x-correlation-id')).toMatch(/^corr_/);
    const json = (await res.json()) as {
      data: { id: string; type: string; createdAt: string };
      version: string;
      correlationId: string;
    };
    expect(json.version).toBe('v1');
    expect(json.correlationId).toMatch(/^corr_/);
    expect(json.data.type).toBe('feature_request');
    expect(typeof json.data.id).toBe('string');

    // And the summary reflects it.
    const sum = await summary();
    expect(sum.status).toBe(200);
    const sumJson = (await sum.json()) as { data: { featureRequests: number; total: number } };
    expect(sumJson.data.featureRequests).toBe(1);
    expect(sumJson.data.total).toBe(1);
  });

  it('rejects a body outside the shared vocabulary with a 422 envelope', async () => {
    const identity = await createTestIdentity(db, { email: 'route-invalid@kloyya.test' });
    switchActor(identity);

    const res = await post({ type: 'rant', body: 'grr' });

    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: { errorCode: string; correlationId: string } };
    expect(json.error.errorCode).toBe('validation_failed');
    expect(json.error.correlationId).toMatch(/^corr_/);
  });

  it('requires a session — 401 with the KAS envelope', async () => {
    switchActor(null);

    const res = await post({ type: 'bug', body: 'anonymous grievance' });

    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: { errorCode: string } };
    expect(json.error.errorCode).toBe('unauthorized');
  });

  it('requires a PROVEN email — 403 email_not_verified for an unverified session', async () => {
    const identity = await createTestIdentity(db, {
      email: 'route-unverified@kloyya.test',
      verified: false,
    });
    switchActor(identity);

    const res = await post({ type: 'bug', body: 'from an unproven address' });

    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: { errorCode: string } };
    expect(json.error.errorCode).toBe('email_not_verified');
  });

  it('404s a signed-in caller with no provisioned profile', async () => {
    const identity = await createTestIdentity(db, {
      email: 'route-unprovisioned@kloyya.test',
      provision: false,
    });
    switchActor(identity);

    const res = await summary();

    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: { errorCode: string } };
    expect(json.error.errorCode).toBe('not_found');
  });
});
