import type { Metadata } from 'next';
import { LegalDocument } from '@/features/landing/components/legal-document';
import { SiteFooter, SiteHeader } from '@/features/landing/components/landing-page';
import { TRUST_CENTER } from '@/features/landing/legal-content';

/**
 * The public Trust Center — security, privacy, and responsible-AI overview for
 * anyone deciding whether to sign up. Distinct from the authenticated `/trust`
 * page (Trust Centre in the app sidebar), which shows a signed-in user their
 * own connected permissions rather than general policy.
 */
export const metadata: Metadata = {
  title: 'Trust Center · Kloyya',
  description: 'How Kloyya protects your data, builds AI responsibly, and keeps the platform reliable.',
  robots: { index: false, follow: false },
};

export default function TrustCenterPage() {
  return (
    <div className="light landing bg-[var(--landing-bg)] text-[color:var(--landing-ink)] min-h-dvh">
      <SiteHeader />
      <main id="main">
        <LegalDocument doc={TRUST_CENTER} />
      </main>
      <SiteFooter />
    </div>
  );
}
