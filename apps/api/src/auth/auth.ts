import { betterAuth } from 'better-auth';
import type { AppDb } from '@kloyya/db';
import { config } from '../config.js';
import { buildAuthOptions, type AuthDeps } from './options.js';

/**
 * The concrete Better Auth instance type, derived from the library so it tracks
 * the installed version.
 */
export type Auth = ReturnType<typeof betterAuth>;

/** Build an auth instance over a given database (server passes the real client,
 *  tests pass PGLite). */
export function buildAuth(db: AppDb, deps: AuthDeps): Auth {
  return betterAuth(buildAuthOptions(db, deps));
}

/**
 * The real database client, or `null` when DATABASE_URL isn't set. Imported
 * dynamically because @kloyya/db's client throws at module evaluation without a
 * connection string — the foundation must still boot before one exists.
 */
export async function resolveDbFromEnv(): Promise<AppDb | null> {
  if (!config.DATABASE_URL) return null;
  const { db } = await import('@kloyya/db');
  return db;
}

/** Auth over a given db, using the validated env, or null if no secret is set. */
export function buildAuthFromEnv(db: AppDb): Auth | null {
  if (!config.BETTER_AUTH_SECRET) return null;
  return buildAuth(db, {
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.BETTER_AUTH_URL,
    trustedOrigins: config.CORS_ALLOWED_ORIGINS,
  });
}
