import type { Metadata } from 'next';
import { LegalDocument } from '@/features/landing/components/legal-document';
import { SiteFooter, SiteHeader } from '@/features/landing/components/landing-page';
import { TERMS_OF_SERVICE } from '@/features/landing/legal-content';

/** Public by design — see PUBLIC_ROUTES in middleware.ts and app/privacy/page.tsx. */
export const metadata: Metadata = {
  title: 'Terms of Service · Kloyya',
  description: 'The terms that govern access to and use of Kloyya.',
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return (
    <div className="light landing bg-[var(--landing-bg)] text-[color:var(--landing-ink)] min-h-dvh">
      <SiteHeader />
      <main id="main">
        <LegalDocument doc={TERMS_OF_SERVICE} />
      </main>
      <SiteFooter />
    </div>
  );
}
