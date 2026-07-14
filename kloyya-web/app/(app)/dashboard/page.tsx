import type { Metadata } from 'next';
import { Dashboard } from '@/features/dashboard/components/dashboard';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: "Today's executive briefing.",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <Dashboard />;
}
