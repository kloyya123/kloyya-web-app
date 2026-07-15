import type { Metadata } from 'next';
import { ConnectionManager } from '@/features/connections/components/connection-manager';

export const metadata: Metadata = {
  title: 'Connect your tools',
  description: 'Connect the apps your work already lives in.',
  robots: { index: false, follow: false },
};

export default function ConnectionsPage() {
  return <ConnectionManager />;
}
