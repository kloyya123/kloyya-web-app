import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

/**
 * Crawl rules.
 *
 * The marketing site and its indexing now live at kloyya.com, a separate
 * deployment. This app is login/signup and the authenticated product, so
 * only the two auth entry points are worth indexing — `/` is just a redirect
 * to `/login` and earns nothing by being crawled. Everything else is behind
 * a session or a provisioning step, and a crawler that follows them gets a
 * redirect for its trouble.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/login', '/signup'],
      disallow: [
        '/',
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
