import * as Sentry from '@sentry/nextjs';

/**
 * Browser-side error tracking. Auto-loaded by Next.js (this exact filename,
 * project root) before any client code runs.
 *
 * No DSN configured means `Sentry.init` no-ops — every call below becomes a
 * harmless stub, same degrade-honestly shape as every other optional
 * integration in this codebase (PostHog, Resend, the OAuth providers). There
 * is deliberately no code branching on whether the DSN is set; the SDK
 * already does that.
 */
Sentry.init({
  dsn: process.env['NEXT_PUBLIC_SENTRY_DSN'],
  // Errors matter far more than performance traces at this stage, and every
  // trace is a paid event on Sentry's free tier — keep this low rather than
  // silently burning the quota on normal traffic.
  tracesSampleRate: 0.1,
  // No session replay: it would capture whatever's on screen when an error
  // fires, and this product's screens routinely show a user's own mail,
  // calendar, and documents. Not worth the privacy exposure for the debugging
  // value it adds.
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
