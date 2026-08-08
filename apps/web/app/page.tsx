import type { Metadata } from 'next';
import { LandingPage } from '@/features/landing/components/landing-page';

/**
 * `/` is the marketing front door.
 *
 * It previously redirected to /login, because the V1 spec put the landing page
 * in a separate repository. It now lives here so both surfaces share one domain
 * and one design system. Middleware forwards an authenticated visitor straight
 * to their dashboard, so a signed-in user never sees this page.
 *
 * This is the only indexable route in the app — every other page sets
 * `robots: noindex` — so its metadata is the whole of Kloyya's search presence.
 */
export const metadata: Metadata = {
  title: 'Kloyya · Your AI Chief of Staff',
  description:
    'Kloyya connects your mail, calendar, and documents, then hands you the short list each morning — what moved, what slipped, and what needs you. It drafts your replies and waits for your approval before sending.',
  keywords: [
    'AI chief of staff',
    'AI assistant for work',
    'email triage',
    'daily briefing',
    'meeting preparation',
    'inbox prioritisation',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Kloyya',
    title: 'Kloyya · Your AI Chief of Staff',
    description:
      'Connect your tools. Kloyya reads the day before you do, drafts the replies, and waits for your nod before anything is sent.',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kloyya · Your AI Chief of Staff',
    description: 'Kloyya reads the day before you do. Connect your tools and get your time back.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

/**
 * Structured data, so a search result can show the product rather than a title
 * and a grey line. Every field is verifiable from the page itself. No `offers`
 * block: pricing isn't shown on the site while there is no live payment
 * provider, and a search result advertising a price nobody can actually pay
 * is worse than no price at all.
 */
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Kloyya',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'An AI chief of staff that reads your mail, calendar, and documents, briefs you each morning, and drafts replies for your approval.',
};

export default function RootPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // A static, author-controlled object. No user input reaches this string.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <LandingPage />
    </>
  );
}
