import type { NextConfig } from 'next';

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

const contentSecurityPolicy = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' blob: data:`,
  `font-src 'self' data:`,
  // Tightened to the API origin once a backend exists.
  `connect-src 'self'`,
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

export default nextConfig;
