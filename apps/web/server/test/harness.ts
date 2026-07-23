import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { AppDb } from '@kloyya/db/client';
import type { Identity } from '../auth/identity';
import { setTestDeps, type Deps } from '../deps';
import { provisionTenantForUser } from '../users/provision';
import { resolveStartContext, type StartContext } from '../tenant';

/**
 * Test support: the real server engine over a real, throwaway Postgres.
 *
 * Each suite boots an in-memory PGLite, applies the committed migrations, and
 * (for route tests) installs itself as the deps container — no Supabase, no
 * network, no shared state between suites. Identity is FABRICATED, not
 * authenticated: PGLite has no Supabase auth schema, and the deps seam exists
 * precisely so the server never notices the difference.
 */
const here = dirname(fileURLToPath(import.meta.url));
// apps/web/server/test → repo root → packages/db/drizzle
const migrationsFolder = resolve(here, '../../../../packages/db/drizzle');

export async function createTestDb(): Promise<{ db: AppDb; client: PGlite }> {
  const client = new PGlite();
  const pglite = drizzle(client);
  await migrate(pglite, { migrationsFolder });
  // PGLite exposes the same query surface the services use; cast at this seam
  // rather than threading a driver union through every signature.
  return { db: pglite as unknown as AppDb, client };
}

export interface TestIdentityInput {
  email: string;
  name?: string;
  /** Defaults true — an unverified caller is the exceptional case to opt into. */
  verified?: boolean;
  /** Defaults true — set false to model a signed-in but unprovisioned user. */
  provision?: boolean;
}

/**
 * Fabricate a Supabase-style identity and (by default) provision its tenant,
 * mirroring what the first authenticated session does in production.
 *
 * There is no identity table to seed anymore — Supabase Auth owns identity, and
 * `users.id` is just the auth uid with no foreign key — so this simply mints a
 * uuid and provisions against it, exactly as `ensureProvisioned` does at
 * runtime.
 */
export async function createTestIdentity(
  db: AppDb,
  input: TestIdentityInput,
): Promise<Identity> {
  const name = input.name ?? 'Test User';
  const verified = input.verified ?? true;
  const id = randomUUID();

  if (input.provision ?? true) {
    await provisionTenantForUser(db, { id, name, email: input.email });
  }

  return { id, email: input.email, fullName: name, emailVerified: verified };
}

/** The tenant coordinates for a provisioned identity. */
export async function startContextFor(db: AppDb, identity: Identity): Promise<StartContext> {
  const ctx = await resolveStartContext(db, identity.id);
  if (!ctx) throw new Error(`Identity ${identity.email} has no provisioned tenant.`);
  return ctx;
}

/**
 * Install the test deps container: this database, acting as this identity.
 * Pass `identity: null` to model an unauthenticated request. Returns a
 * switcher so multi-actor tests can change who is calling mid-test.
 */
export function actAs(db: AppDb, identity: Identity | null): (next: Identity | null) => void {
  let current = identity;
  const deps: Deps = {
    db,
    getIdentity: async () => current,
  };
  setTestDeps(deps);
  return (next) => {
    current = next;
  };
}

/** Remove the test deps override (call in afterAll/afterEach). */
export function resetDeps(): void {
  setTestDeps(null);
}
