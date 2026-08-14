import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

/**
 * Content Security Policy.
 *
 * KFA requires "Support CSP" but no Kloyya document specifies header values,
 * so these are derived. Each relaxation below is a real Next.js constraint,
 * annotated so it can be revisited rather than cargo-culted.
 *
 * `'unsafe-inline'` on style-src: Next injects inline <style> for critical CSS
 * and next/font. Nonce-ing those requires middleware-generated nonces threaded
 * through the document — worth doing before production, but it buys nothing
 * against a frontend with no user-generated HTML.
 *
 * `'unsafe-eval'` in development only: React Refresh needs it. It is absent
 * from the production policy.
 */
const isDev = process.env.NODE_ENV === 'development';

// The browser talks to Supabase directly for Auth (token refresh) and Storage
// (signed-URL uploads), so its origin must be allowed for fetch/XHR. Derived
// from the public URL; falls back to allowing all https in dev only.
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) {
    try {
      return new URL(url).origin;
    } catch {
      /* fall through */
    }
  }
  return isDev ? 'https:' : '';
})();

// PostHog (product analytics) loads its script and sends events to its own
// hosts, so they must be allowed when a PostHog key is configured. Empty
// otherwise, keeping the policy tight for deployments that don't use it.
const posthogHosts = process.env.NEXT_PUBLIC_POSTHOG_KEY
  ? 'https://us.i.posthog.com https://us-assets.i.posthog.com'
  : '';

// Sentry's browser SDK reports errors straight from the client, so its
// ingest host needs the same connect-src allowance as PostHog — empty when
// no DSN is configured, same reasoning.
const sentryHost = (() => {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return '';
  try {
    // .origin never includes the DSN's embedded public key — just the host
    // Sentry's SDK actually posts events to.
    return new URL(dsn).origin;
  } catch {
    return '';
  }
})();

const contentSecurityPolicy = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} ${posthogHosts}`.trim(),
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' blob: data:`,
  `font-src 'self' data:`,
  // 'self' covers the same-origin /api routes; Supabase covers auth + storage;
  // PostHog covers analytics ingestion; Sentry covers error reporting — both
  // opt-in, both empty when unconfigured.
  `connect-src 'self' ${supabaseOrigin} ${posthogHosts} ${sentryHost}`.trim(),
  `frame-ancestors 'none'`,
  `form-action 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  // Redundant with frame-ancestors; retained for older browsers.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  // KESM mandates TLS 1.3 and HTTPS everywhere.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // The shared contract and the database layer ship as raw TypeScript
  // (packages/{core,db}/src/*.ts), so Next must transpile them rather than
  // expecting pre-built JS.
  transpilePackages: ['@kloyya/core', '@kloyya/db'],

  // Heavy/native server dependencies stay out of the webpack bundle and are
  // required at runtime instead. postgres is the DB driver; mammoth extracts
  // docx text; pino is transitively referenced by ported server code.
  serverExternalPackages: ['postgres', 'mammoth', 'pino', 'resend', 'unpdf', 'xlsx'],

  // @kloyya/core and @kloyya/db are consumed as raw TypeScript, and — being
  // written for Node's ESM loader — their own internal relative imports use
  // explicit `.js` specifiers (e.g. `./schema.js`) that point at `.ts` files.
  // Node/tsx resolve that transparently; webpack does not, and fails the whole
  // package the moment it follows one such import chain (not just the barrel —
  // any file with an internal relative import, like db's client.ts importing
  // its own schema.ts). This alias is the standard fix: let `.js` specifiers
  // resolve to their `.ts` source inside the webpack graph.
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },

  // The Quality Gate treats type and lint errors as blocking.
  // A production build must never paper over them.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },

  // Don't advertise the framework version to scanners.
  poweredByHeader: false,

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

/**
 * withSentryConfig wraps the build to also upload source maps, so a stack
 * trace in Sentry shows real file/line numbers instead of minified gibberish.
 * That upload step needs SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT — all
 * absent, all optional. Without them this silently skips the upload (a
 * documented Sentry behavior, not something branched on here) and the rest
 * of the build proceeds exactly as it did before Sentry existed. `silent:
 * true` stops that skip from printing noise on every build in a deployment
 * that isn't using Sentry at all.
 */
export default withSentryConfig(nextConfig, {
  ...(process.env.SENTRY_ORG ? { org: process.env.SENTRY_ORG } : {}),
  ...(process.env.SENTRY_PROJECT ? { project: process.env.SENTRY_PROJECT } : {}),
  ...(process.env.SENTRY_AUTH_TOKEN ? { authToken: process.env.SENTRY_AUTH_TOKEN } : {}),
  silent: true,
  disableLogger: true,
});
