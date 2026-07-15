import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { BetterAuthOptions } from 'better-auth';
import { account, session, user, verification } from '@kloyya/db/schema';

/**
 * Better Auth configuration, as a factory over the database.
 *
 * Taking `db` as a parameter (rather than importing the singleton) is what makes
 * auth testable: the server passes the real postgres-js client, tests pass an
 * in-memory PGLite one. We import the *tables* from `@kloyya/db/schema` — the
 * side-effect-free subpath — so building options never touches the runtime
 * client (which would demand DATABASE_URL).
 *
 * `generateId: false` defers id creation to Postgres, so identities get real
 * UUIDs from the tables' `defaultRandom()` — consistent with the rest of the
 * schema. The four models map to the tables we defined to Better Auth's exact
 * field shapes, so no column renaming is needed.
 */
export interface AuthDeps {
  /** Signs sessions and tokens. Must be stable across restarts. */
  secret: string;
  /** The API's own base URL, for callback/verification links. */
  baseURL: string;
  /** Origins allowed to drive the auth flows (the web app). */
  trustedOrigins?: string[];
}

type DrizzleDb = Parameters<typeof drizzleAdapter>[0];

export function buildAuthOptions(db: DrizzleDb, deps: AuthDeps): BetterAuthOptions {
  return {
    secret: deps.secret,
    baseURL: deps.baseURL,
    ...(deps.trustedOrigins ? { trustedOrigins: deps.trustedOrigins } : {}),
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      // Email delivery is wired in Phase 4c; until then, don't gate sign-in on a
      // verification link nobody can receive.
      requireEmailVerification: false,
    },
    // Let Postgres mint ids (UUID defaults), not the application layer.
    advanced: { database: { generateId: false } },
  };
}
