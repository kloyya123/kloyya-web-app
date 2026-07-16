import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { sql } from 'drizzle-orm';
import { betterAuth } from 'better-auth';
import type { AppDb } from '@kloyya/db';
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
    // PGLite exposes the same query surface; cast at the driver seam.
    buildAuthOptions(db as unknown as AppDb, {
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

  it('provisions a full tenant for the new user', async () => {
    const { client, db, auth } = await freshAuth();

    const { user: created } = await auth.api.signUpEmail({
      body: { email: 'owner@kloyya.test', password: 'a strong passphrase', name: 'Owner Person' },
    });

    // The org is a placeholder named from the user; onboarding renames it.
    const orgs = await db.execute<{ id: string; name: string; industry: string }>(
      sql`SELECT id, name, industry FROM "organizations"`,
    );
    expect(orgs.rows).toHaveLength(1);
    expect(orgs.rows[0]?.name).toBe("Owner Person's Organization");
    expect(orgs.rows[0]?.industry).toBe('');

    const workspaces = await db.execute<{ id: string; name: string; organization_id: string }>(
      sql`SELECT id, name, organization_id FROM "workspaces"`,
    );
    expect(workspaces.rows).toHaveLength(1);
    expect(workspaces.rows[0]?.name).toBe('General');
    expect(workspaces.rows[0]?.organization_id).toBe(orgs.rows[0]?.id);

    // The profile shares the auth user's id (1:1) and opens on that workspace.
    const profiles = await db.execute<{
      id: string;
      organization_id: string;
      active_workspace_id: string;
      has_completed_onboarding: boolean;
    }>(sql`SELECT id, organization_id, active_workspace_id, has_completed_onboarding FROM "users"`);
    expect(profiles.rows).toHaveLength(1);
    expect(profiles.rows[0]?.id).toBe(created.id);
    expect(profiles.rows[0]?.organization_id).toBe(orgs.rows[0]?.id);
    expect(profiles.rows[0]?.active_workspace_id).toBe(workspaces.rows[0]?.id);
    expect(profiles.rows[0]?.has_completed_onboarding).toBe(false);

    // Whoever creates the organization owns it.
    const mships = await db.execute<{ user_id: string; role: string; workspace_id: string }>(
      sql`SELECT user_id, role, workspace_id FROM "memberships"`,
    );
    expect(mships.rows).toHaveLength(1);
    expect(mships.rows[0]?.user_id).toBe(created.id);
    expect(mships.rows[0]?.role).toBe('owner');
    expect(mships.rows[0]?.workspace_id).toBe(workspaces.rows[0]?.id);

    // Preferences exist with the Manifesto's defaults, not `everything`.
    const prefs = await db.execute<{ user_id: string; notification_level: string; work_style: string }>(
      sql`SELECT user_id, notification_level, work_style FROM "user_preferences"`,
    );
    expect(prefs.rows).toHaveLength(1);
    expect(prefs.rows[0]?.user_id).toBe(created.id);
    expect(prefs.rows[0]?.notification_level).toBe('important_only');
    expect(prefs.rows[0]?.work_style).toBe('deep_focus');

    await client.close();
  });
});
