import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

/**
 * Crawl rules.
 *
 * Only `/` and the two auth entry points are worth indexing; everything else is
 * either behind a session or a provisioning step, and a crawler that follows
 * them gets a redirect to /login for its trouble. Disallowing them keeps the
 * index clean and stops "Sign in to Kloyya" outranking the actual home page.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/dashboard',
        '/inbox',
        '/tasks',
        '/calendar',
        '/meetings',
        '/documents',
        '/drafts',
        '/connections',
        '/settings',
        '/onboarding',
        '/workspace-init',
        '/verify-email',
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
