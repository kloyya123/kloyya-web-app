import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

/**
 * The three publicly reachable routes. Everything else needs a session, so
 * listing it would only earn crawl errors.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  const lastModified = new Date();

  return [
    { url: origin, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${origin}/signup`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${origin}/login`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
  ];
}
