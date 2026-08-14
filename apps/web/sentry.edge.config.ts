import * as Sentry from '@sentry/nextjs';

/**
 * Edge runtime error tracking — middleware.ts runs here, not in Node, so it
 * needs its own init separate from sentry.server.config.ts (the Edge runtime
 * can't use everything the Node SDK does). Loaded via instrumentation.ts.
 *
 * Same no-DSN-means-no-op contract as the other two configs.
 */
Sentry.init({
  dsn: process.env['NEXT_PUBLIC_SENTRY_DSN'],
  tracesSampleRate: 0.1,
});
