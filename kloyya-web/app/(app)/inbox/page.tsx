import type { Metadata } from 'next';
import { InboxList } from '@/features/inbox/components/inbox-list';

export const metadata: Metadata = {
  title: 'Inbox',
  description: 'Triaged mail: what needs you now, and why.',
  robots: { index: false, follow: false },
};

export default function InboxPage() {
  return <InboxList />;
}
