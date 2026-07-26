/**
 * The public origin this deployment is reachable at.
 *
 * Absolute URLs in sitemaps, canonical tags, and Open Graph metadata cannot be
 * relative, so they need the real origin — and hardcoding one breaks every
 * preview deployment. Order of preference:
 *
 *   1. NEXT_PUBLIC_SITE_URL — set this on production; it is the only value that
 *      survives a custom domain.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel's own answer for "the production
 *      domain", correct even when read from a preview build.
 *   3. VERCEL_URL — the per-deployment hostname, right for previews.
 *   4. localhost, for `next dev`.
 *
 * Returns an origin with no trailing slash, so callers can append a path.
 */
export function siteUrl(): string {
  const explicit = process.env['NEXT_PUBLIC_SITE_URL'];
  if (explicit) return explicit.replace(/\/$/, '');

  const production = process.env['VERCEL_PROJECT_PRODUCTION_URL'];
  if (production) return `https://${production}`;

  const deployment = process.env['VERCEL_URL'];
  if (deployment) return `https://${deployment}`;

  return 'http://localhost:3000';
}
