import type { Metadata } from 'next';
import { DraftsView } from '@/features/drafts/components/drafts-view';

export const metadata: Metadata = {
  title: 'Drafts',
  description: 'Everything you’re writing, saved as you type.',
  robots: { index: false, follow: false },
};

export default function DraftsPage() {
  return <DraftsView />;
}
