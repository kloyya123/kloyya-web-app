import type { Metadata } from 'next';
import { MeetingsList } from '@/features/meetings/components/meetings-list';

export const metadata: Metadata = {
  title: 'Meetings',
  description: 'Briefings before, summaries and decisions after.',
  robots: { index: false, follow: false },
};

export default function MeetingsPage() {
  return <MeetingsList />;
}
