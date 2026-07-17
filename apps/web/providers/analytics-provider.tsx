'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  analyticsEnabled,
  identifyUser,
  initAnalytics,
  resetAnalytics,
  trackPageView,
} from '@/lib/analytics';
import { useAuth } from '@/providers/auth-provider';

/**
 * Wires analytics to the app's lifecycle without any feature having to know how.
 *
 * It does three things and only when a project key is configured: start PostHog
 * once, send a page view on each App-Router navigation (there are no full page
 * loads to capture automatically), and keep the identified user in sync with the
 * session — identify on sign-in, reset on sign-out so two people who share a
 * browser are never conflated.
 */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { session } = useAuth();
  const identified = useRef<string | null>(null);

  // Start once on the client.
  useEffect(() => {
    initAnalytics();
  }, []);

  // A page view per route change.
  useEffect(() => {
    if (pathname) trackPageView(pathname);
  }, [pathname]);

  // Identify on sign-in; reset on sign-out. Guarded so we don't re-identify the
  // same user on every render.
  useEffect(() => {
    if (!analyticsEnabled()) return;
    const userId = session?.user.id ?? null;
    if (userId && identified.current !== userId) {
      identifyUser(userId);
      identified.current = userId;
    } else if (!userId && identified.current) {
      resetAnalytics();
      identified.current = null;
    }
  }, [session]);

  return <>{children}</>;
}
