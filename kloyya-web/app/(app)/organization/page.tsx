import type { Metadata } from 'next';
import { OrganizationOverview } from '@/features/organization/components/organization-overview';

export const metadata: Metadata = {
  title: 'Organization',
  description: 'Your company, its workspace Trust Score, and everyone in it.',
  robots: { index: false, follow: false },
};

export default function OrganizationPage() {
  return <OrganizationOverview />;
}
