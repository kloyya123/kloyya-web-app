import type { Metadata } from 'next';
import { LegalDocument } from '@/features/landing/components/legal-document';
import { SiteFooter, SiteHeader } from '@/features/landing/components/landing-page';
import { HELP_CENTER } from '@/features/landing/legal-content';

export const metadata: Metadata = {
  title: 'Help Center · Kloyya',
  description: 'Getting started with Kloyya, and answers to common questions.',
  robots: { index: false, follow: false },
};

export default function HelpPage() {
  return (
    <div className="light landing bg-[var(--landing-bg)] text-[color:var(--landing-ink)] min-h-dvh">
      <SiteHeader />
      <main id="main">
        <LegalDocument doc={HELP_CENTER} />
      </main>
      <SiteFooter />
    </div>
  );
}
