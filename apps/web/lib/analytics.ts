import posthog from 'posthog-js';


const KEY = process.env['NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN'];
const HOST = process.env['NEXT_PUBLIC_POSTHOG_HOST'];


let ready = false;

export function analyticsEnabled(): boolean {
  return typeof window !== 'undefined' && typeof KEY === 'string' && KEY.length > 0 && typeof HOST === 'string' && HOST.length > 0;
}


export function initAnalytics(): void {
  if (ready) return;
  
  if (!analyticsEnabled()) {
    // ✅ CORRECTION : Ne pas crasher l'app en développement si la clé est absente.
    // On affiche un avertissement et on laisse l'app fonctionner en mode "no-op".
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[Analytics] PostHog token missing. Running in no-op mode. Add NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN to .env.local to enable.'
      );
    }
    return;
  }

  posthog.init(KEY as string, {
    api_host: HOST as string,
   
    capture_pageview: false,
   
    persistence: 'localStorage+cookie',

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
