import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { sql } from 'drizzle-orm';
import { betterAuth } from 'better-auth';
import { buildAuthOptions } from './options.js';

/**
 * Better Auth ↔ Drizzle adapter smoke test.
 *
 * Proves the schema we defined (packages/db) is what better-auth@1.6.23's
 * adapter actually expects: a real sign-up must create a `user` row with a
 * Postgres-minted UUID id and a hashed password in `account` — against real
 * Postgres (PGLite), no cloud, no credentials. This is the guard that the KAS
 * "not complete when it compiles" bar demands for the auth foundation.
 */
const here = dirname(fileURLToPath(import.meta.url));
// apps/api/src/auth → repo root → packages/db/drizzle
const migrationsFolder = resolve(here, '../../../../packages/db/drizzle');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function freshAuth() {
  const client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder });
  const auth = betterAuth(
    buildAuthOptions(db, {
      secret: 'test-secret-value-at-least-32-characters-long',
      baseURL: 'http://localhost:4000',
    }),
  );
  return { client, db, auth };
}

describe('Better Auth + Drizzle adapter (PGLite)', () => {
  it('signs up an email/password user with a Postgres-minted UUID id', async () => {
    const { client, db, auth } = await freshAuth();

    const result = await auth.api.signUpEmail({
      body: { email: 'ada@kloyya.test', password: 'correct horse battery', name: 'Ada Lovelace' },
    });

    expect(result.user.id).toMatch(UUID_RE);
    expect(result.user.email).toBe('ada@kloyya.test');

    // The row really landed, with the adapter's snake_case column mapping.
    const rows = await db.execute<{ id: string; email: string; email_verified: boolean }>(
      sql`SELECT id, email, email_verified FROM "user"`,
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]?.id).toMatch(UUID_RE);
    expect(rows.rows[0]?.email).toBe('ada@kloyya.test');

    // The email/password provider stored a hashed secret in `account` — never plaintext.
    const accounts = await db.execute<{ password: string | null; provider_id: string }>(
      sql`SELECT password, provider_id FROM "account"`,
    );
    expect(accounts.rows).toHaveLength(1);
    expect(accounts.rows[0]?.provider_id).toBe('credential');
    expect(accounts.rows[0]?.password).toBeTruthy();
    expect(accounts.rows[0]?.password).not.toContain('correct horse battery');

    await client.close();
  });

  it('rejects a duplicate email', async () => {
    const { client, auth } = await freshAuth();
    const body = { email: 'dup@kloyya.test', password: 'a strong passphrase', name: 'Dup' };

    await auth.api.signUpEmail({ body });
    await expect(auth.api.signUpEmail({ body })).rejects.toThrow();

    await client.close();
  });
});
