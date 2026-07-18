import type { Metadata } from 'next';
import { AskView } from '@/features/ask/components/ask-view';

export const metadata: Metadata = {
  title: 'Ask Kloyya',
  description: 'Ask anything about your work — answered from your connected tools, with sources.',
  robots: { index: false, follow: false },
};

export default function AskPage() {
  return <AskView />;
}
