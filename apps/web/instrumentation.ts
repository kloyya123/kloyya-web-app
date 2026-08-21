import * as Sentry from '@sentry/nextjs';

/**
 * Next.js's own instrumentation hook — runs once per runtime, before any
 * other code in that runtime. This is what actually loads the two
 * server-side Sentry configs; instrumentation-client.ts is separate and
 * auto-loaded by Next.js on the browser side.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * Catches errors from nested React Server Components that a normal
 * try/catch in a route handler never sees — Next.js calls this directly.
 * A no-op when Sentry has no DSN, same as everywhere else.
 */
export const onRequestError = Sentry.captureRequestError;
