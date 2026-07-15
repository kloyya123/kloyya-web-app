import { betterAuth } from 'better-auth';
import { config } from '../config.js';
import { buildAuthOptions, type AuthDeps } from './options.js';

/**
 * The concrete Better Auth instance type, derived from the library so it tracks
 * the installed version.
 */
export type Auth = ReturnType<typeof betterAuth>;

type DrizzleDb = Parameters<typeof buildAuthOptions>[0];

/** Build an auth instance over a given database (server passes the real client,
 *  tests pass PGLite). */
export function buildAuth(db: DrizzleDb, deps: AuthDeps): Auth {
  return betterAuth(buildAuthOptions(db, deps));
}

/**
 * The app's auth, resolved from validated env — or `null` when it isn't
 * configured yet (no DATABASE_URL or no BETTER_AUTH_SECRET). The db client is
 * imported dynamically so the foundation still boots before those exist; the
 * routes simply aren't mounted until they do.
 */
export async function resolveAuthFromEnv(): Promise<Auth | null> {
  if (!config.DATABASE_URL || !config.BETTER_AUTH_SECRET) return null;
  const { db } = await import('@kloyya/db');
  return buildAuth(db, {
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.BETTER_AUTH_URL,
    trustedOrigins: config.CORS_ALLOWED_ORIGINS,
  });
}
