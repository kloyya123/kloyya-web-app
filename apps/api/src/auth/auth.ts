import { betterAuth } from 'better-auth';
import type { AppDb } from '@kloyya/db';
import { config, isProduction } from '../config.js';
import { createLoggingSender, type EmailSender } from '../email/sender.js';
import { createResendSender } from '../email/resend.js';
import { logger } from '../logger.js';
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

/**
 * The email sender for this environment.
 *
 * Without an API key we fall back to logging the message. That is a genuinely
 * useful dev affordance — you can read the code out of the terminal — and a
 * catastrophe in production, where it would print verification codes into the
 * logs and deliver nothing. So production refuses to start instead.
 */
export function resolveEmailSender(): EmailSender {
  if (config.RESEND_API_KEY) {
    return createResendSender(config.RESEND_API_KEY, config.EMAIL_FROM);
  }
  if (isProduction) {
    throw new Error(
      'RESEND_API_KEY is required in production — refusing to start with an email sender that only logs.',
    );
  }
  logger.warn('No RESEND_API_KEY — verification codes will be logged, not emailed.');
  return createLoggingSender((message) => logger.info(message));
}

/** Auth over a given db, using the validated env, or null if no secret is set. */
export function buildAuthFromEnv(db: AppDb): Auth | null {
  if (!config.BETTER_AUTH_SECRET) return null;
  return buildAuth(db, {
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.BETTER_AUTH_URL,
    trustedOrigins: config.CORS_ALLOWED_ORIGINS,
    email: resolveEmailSender(),
  });
}
