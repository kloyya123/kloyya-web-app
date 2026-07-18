import type { Metadata } from 'next';
import { Paywall } from '@/features/billing/components/paywall';

export const metadata: Metadata = {
  title: 'Start Pro',
  description: 'Add a payment method to start your Kloyya Pro plan.',
  robots: { index: false, follow: false },
};

export default function PaywallPage() {
  return <Paywall />;
}
