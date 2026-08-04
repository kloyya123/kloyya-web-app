import posthog from 'posthog-js';

/**
 * Product analytics, behind one seam.
 *
 * Nothing in the app imports posthog-js directly — features call `trackEvent`,
 * and this module decides whether anything actually happens. The whole thing is a
 * no-op unless a PROJECT key (`phc_…`) is present in `NEXT_PUBLIC_POSTHOG_KEY`, so
 * local dev and tests never phone home, and a missing key degrades to silence
 * rather than a crash.
 *
 * Note the key kinds: only a `phc_` project key belongs in a NEXT_PUBLIC_* var —
 * it is meant to reach the browser. A `phx_` personal key is a secret and must
 * never be exposed here; it lives server-side for the management API only.
 */
const KEY = process.env['NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN'];
const HOST = process.env['NEXT_PUBLIC_POSTHOG_HOST'];

/** True once init has run against a real key. Guards every call below. */
let ready = false;

/** True when a project key is configured — analytics can run at all. */
export function analyticsEnabled(): boolean {
  return typeof window !== 'undefined' && typeof KEY === 'string' && KEY.length > 0 && typeof HOST === 'string' && HOST.length > 0;
}

/** Start PostHog once, on the client. Safe to call repeatedly. */
export function initAnalytics(): void {
  if (ready) return;
  if (!analyticsEnabled()) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(
        'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
      );
    }
    return;
  }
  posthog.init(KEY as string, {
    api_host: HOST as string,
    // We send page views ourselves on route change (App Router gives no full
    // navigations), so the automatic pageview capture would double-count.
    capture_pageview: false,
    // No cross-site tracking; this is first-party product analytics only.
    persistence: 'localStorage+cookie',
    // Error monitoring: PostHog already captures uncaught browser exceptions
    // (with a stack trace and the session that hit them) once a project key is
    // configured — a dedicated Sentry project is a later, separate decision,
    // not a gap to fill before launch.
    capture_exceptions: true,
  });
  ready = true;
}

/** A named product event. Silently dropped when analytics is off. */
export function trackEvent(event: string, properties?: Record<string, unknown>): void {
  if (!ready) return;
  posthog.capture(event, properties);
}

/** One page view. Called by the analytics provider on each route change. */
export function trackPageView(path: string): void {
  if (!ready) return;
  posthog.capture('$pageview', { $current_url: path });
}

/** Tie subsequent events to a known user. Called once a session is present. */
export function identifyUser(userId: string, traits?: Record<string, unknown>): void {
  if (!ready) return;
  posthog.identify(userId, traits);
}

/** Forget the user on sign-out, so the next person is not conflated with them. */
export function resetAnalytics(): void {
  if (!ready) return;
  posthog.reset();
}
