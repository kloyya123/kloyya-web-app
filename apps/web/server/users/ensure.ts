import { eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { users } from '@kloyya/db/schema';
import type { Identity } from '../auth/identity';
import { provisionTenantForUser } from './provision';

/**
 * Ensure the caller's tenant exists — the Supabase-Auth replacement for Better
 * Auth's create-user hook.
 *
 * Better Auth provisioned the tenant in a database hook the instant an identity
 * was created. Supabase owns identity creation, so provisioning moves here:
 * lazy, app-side, idempotent. Called once from GET /v1/session — the first thing
 * every freshly signed-in client fetches — so the org+workspace+profile exist
 * before any other endpoint needs them.
 *
 * The unique-violation catch handles the double-tab race: two concurrent first
 * requests both find no profile, both try to provision, one wins, the other's
 * insert collides on the primary key and is safely ignored.
 */
export async function ensureProvisioned(db: AppDb, identity: Identity): Promise<void> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, identity.id))
    .limit(1);
  if (existing.length > 0) return;

  try {
    await provisionTenantForUser(db, {
      id: identity.id,
      name: identity.fullName ?? '',
      email: identity.email,
    });
  } catch (error) {
    if (isUniqueViolation(error)) return;
    throw error;
  }
}

/** Postgres unique-violation (SQLSTATE 23505), across postgres-js and PGLite. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}
