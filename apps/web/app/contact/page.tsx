import type { Metadata } from 'next';
import { ContactPage } from '@/features/landing/components/contact-page';
import { SiteFooter, SiteHeader } from '@/features/landing/components/landing-page';

export const metadata: Metadata = {
  title: 'Contact · Kloyya',
  description: 'Reach the right team at Kloyya — support, sales, security, privacy, compliance, or legal.',
  robots: { index: false, follow: false },
};

export default function ContactRoute() {
  return (
    <div className="light landing bg-[var(--landing-bg)] text-[color:var(--landing-ink)] min-h-dvh">
      <SiteHeader />
      <main id="main">
        <ContactPage />
      </main>
      <SiteFooter />
    </div>
  );
}
