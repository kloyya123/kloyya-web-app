import type { AppDb } from '@kloyya/db/client';
import type { Identity } from './auth/identity';

/**
 * The server's dependency container — and the test seam.
 *
 * Route handlers never construct their own database client or resolve auth
 * themselves; they ask this container. In production it wires the real client
 * (`@kloyya/db`, cached per process) and the Supabase identity resolver. Under
 * vitest, `setTestDeps` swaps in a PGLite database and a fabricated identity,
 * which is what lets the whole API surface be tested without Supabase Auth or a
 * network.
 *
 * `getDeps` is async because the real database module must be imported lazily:
 * `@kloyya/db` throws at module evaluation when DATABASE_URL is unset, and a
 * Next.js build (which imports every route module) must not require a database.
 */
export interface Deps {
  db: AppDb;
  getIdentity: () => Promise<Identity | null>;
}

let testOverride: Deps | null = null;
let production: Deps | null = null;

export async function getDeps(): Promise<Deps> {
  if (testOverride) return testOverride;
  if (!production) {
    const [{ db }, { getRequestIdentity }] = await Promise.all([
      import('@kloyya/db/client'),
      import('./auth/identity'),
    ]);
    production = { db, getIdentity: getRequestIdentity };
  }
  return production;
}

/** Test-only: replace the container. Throws anywhere near production. */
export function setTestDeps(deps: Deps | null): void {
  if (!process.env['VITEST'] && process.env.NODE_ENV !== 'test') {
    throw new Error('setTestDeps is for tests only.');
  }
  testOverride = deps;
}
