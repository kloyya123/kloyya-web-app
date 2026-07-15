import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { buildAuth } from './auth.js';

/**
 * End-to-end mount test: a real HTTP sign-up flows through the Fastify route,
 * into Better Auth, into PGLite, and comes back with a session cookie. Proves
 * the request/response adapter in routes.ts (URL, headers, JSON body, and the
 * Set-Cookie handling) actually works — not just that it compiles.
 */
const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, '../../../../packages/db/drizzle');

let app: FastifyInstance;

beforeAll(async () => {
  const client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder });
  const auth = buildAuth(db, {
    secret: 'test-secret-value-at-least-32-characters-long',
    baseURL: 'http://localhost:4000',
  });
  app = await buildApp({ auth });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('POST /api/auth/sign-up/email', () => {
  it('creates a user and sets a session cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'grace@kloyya.test', password: 'a sufficiently long passphrase', name: 'Grace' },
    });

    expect(res.statusCode).toBe(200);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeTruthy();
    expect(String(setCookie)).toContain('better-auth');

    const body = res.json<{ user: { email: string; emailVerified: boolean } }>();
    expect(body.user.email).toBe('grace@kloyya.test');
  });

  it('rejects a malformed sign-up (short password) without a cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'bad@kloyya.test', password: 'x', name: 'Bad' },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
