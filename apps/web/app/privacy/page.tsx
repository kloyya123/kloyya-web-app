import type { Metadata } from 'next';
import { LegalDocument } from '@/features/landing/components/legal-document';
import { SiteFooter, SiteHeader } from '@/features/landing/components/landing-page';
import { PRIVACY_POLICY } from '@/features/landing/legal-content';

/**
 * Public by design — see PUBLIC_ROUTES in middleware.ts. Anyone must be able to
 * read this without an account: a visitor deciding whether to sign up, or a
 * reviewer verifying an OAuth consent screen (Google requires a live, reachable
 * privacy policy URL for exactly that).
 */
export const metadata: Metadata = {
  title: 'Privacy Policy · Kloyya',
  description: 'What Kloyya collects, how it is used, and the choices you have over your data.',
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <div className="light landing bg-[var(--landing-bg)] text-[color:var(--landing-ink)] min-h-dvh">
      <SiteHeader />
      <main id="main">
        <LegalDocument doc={PRIVACY_POLICY} />
      </main>
      <SiteFooter />
    </div>
  );
}
