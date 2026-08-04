import { initAnalytics } from '@/lib/analytics';

// Next.js 15.3+ client initialization point. The analytics module owns the
// singleton so all call sites reach the same initialized PostHog instance.
initAnalytics();
