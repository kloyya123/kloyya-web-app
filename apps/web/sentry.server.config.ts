import * as Sentry from '@sentry/nextjs';

/**
 * Server-side (Node runtime) error tracking. Loaded via instrumentation.ts's
 * `register()`, per Next.js's own instrumentation hook — this is where every
 * unhandled error in a Route Handler, server component, or background job
 * (like the cron sync) actually gets caught, not just the browser-visible half.
 *
 * Same no-DSN-means-no-op contract as instrumentation-client.ts.
 */
Sentry.init({
  dsn: process.env['NEXT_PUBLIC_SENTRY_DSN'],
  tracesSampleRate: 0.1,
});
