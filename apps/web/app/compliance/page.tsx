import type { Metadata } from 'next';
import { LegalDocument } from '@/features/landing/components/legal-document';
import { SiteFooter, SiteHeader } from '@/features/landing/components/landing-page';
import { COMPLIANCE } from '@/features/landing/legal-content';

export const metadata: Metadata = {
  title: 'Compliance · Kloyya',
  description: 'How Kloyya approaches security, data protection, and responsible AI.',
  robots: { index: false, follow: false },
};

export default function CompliancePage() {
  return (
    <div className="light landing bg-[var(--landing-bg)] text-[color:var(--landing-ink)] min-h-dvh">
      <SiteHeader />
      <main id="main">
        <LegalDocument doc={COMPLIANCE} />
      </main>
      <SiteFooter />
    </div>
  );
}
