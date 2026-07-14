import type { Metadata } from 'next';
import { TrustCenter } from '@/features/trust-center/components/trust-center';

export const metadata: Metadata = {
  title: 'Trust Center',
  description: "Where Kloyya's intelligence comes from, and how it reaches a decision.",
  robots: { index: false, follow: false },
};

export default function TrustCenterPage() {
  return <TrustCenter />;
}
