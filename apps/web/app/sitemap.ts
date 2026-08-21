import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

/**
 * The two publicly reachable routes. `/` is just a redirect to `/login` and
 * isn't worth listing; the marketing site's own sitemap lives at kloyya.com.
 * Everything else here needs a session, so listing it would only earn crawl
 * errors.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  const lastModified = new Date();

  return [
    { url: `${origin}/signup`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${origin}/login`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
  ];
}
