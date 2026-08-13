import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

/**
 * Every publicly reachable, indexable route. Everything else needs a session
 * (or is deliberately `noindex`), so listing it would only earn crawl errors.
 *
 * Kept in sync by hand with each page's own `robots` metadata — there is no
 * single source of truth to generate this from, so a new public page needs
 * an entry here too.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  const lastModified = new Date();

  return [
    { url: origin, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${origin}/signup`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${origin}/login`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${origin}/trust-center`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${origin}/help`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${origin}/contact`, lastModified, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${origin}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${origin}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${origin}/compliance`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
  ];
}
