import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { FastifyInstance } from 'fastify';
import type { AppDb } from '@kloyya/db';
import { buildApp } from '../app.js';
import { buildAuth } from '../auth/auth.js';
import type { EmailMessage, EmailSender } from '../email/sender.js';

/**
 * Test support: a real API over a real, throwaway Postgres.
 *
 * Each call boots an in-memory PGLite, applies the committed migrations, and
 * builds the app with auth wired to it — no cloud, no credentials, no shared
 * state between suites.
 */
const here = dirname(fileURLToPath(import.meta.url));
// apps/api/src/test → repo root → packages/db/drizzle
const migrationsFolder = resolve(here, '../../../../packages/db/drizzle');

/** An email sender that delivers nowhere and remembers everything. */
export interface RecordingSender extends EmailSender {
  readonly sent: EmailMessage[];
  /** The most recent message to an address, or undefined. */
  lastTo(email: string): EmailMessage | undefined;
  /** The six-digit code in the most recent message to an address. */
  lastCodeTo(email: string): string | undefined;
}

export function createRecordingSender(): RecordingSender {
  const sent: EmailMessage[] = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
    },
    lastTo(email) {
      return [...sent].reverse().find((m) => m.to === email);
    },
    lastCodeTo(email) {
      const message = [...sent].reverse().find((m) => m.to === email);
      return message?.text.match(/\b(\d{6})\b/)?.[1];
    },
  };
}

export interface TestApp {
  app: FastifyInstance;
  db: AppDb;
  client: PGlite;
  /** Every email the app "sent" during the test. */
  email: RecordingSender;
}

export async function createTestApp(): Promise<TestApp> {
  const client = new PGlite();
  const pglite = drizzle(client);
  await migrate(pglite, { migrationsFolder });

  // PGLite exposes the same query surface the services use; cast at this seam
  // rather than threading a driver union through every signature.
  const db = pglite as unknown as AppDb;

  const email = createRecordingSender();
  const auth = buildAuth(db, {
    secret: 'test-secret-value-at-least-32-characters-long',
    baseURL: 'http://localhost:4000',
    email,
  });

  const app = await buildApp({ db, auth, email });
  await app.ready();
  return { app, db, client, email };
}

export interface SignUpResult {
  /** Cookie header to replay on subsequent requests. */
  cookie: string;
  userId: string;
}

/** Sign a user up and return the session cookie to authenticate later calls. */
export async function signUp(
  app: FastifyInstance,
  input: { email: string; password: string; name: string },
): Promise<SignUpResult> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { 'content-type': 'application/json' },
    payload: input,
  });
  if (res.statusCode !== 200) {
    throw new Error(`sign-up failed (${res.statusCode}): ${res.body}`);
  }
  const body = res.json<{ user: { id: string } }>();
  return {
    cookie: res.cookies.map((c) => `${c.name}=${c.value}`).join('; '),
    userId: body.user.id,
  };
}
