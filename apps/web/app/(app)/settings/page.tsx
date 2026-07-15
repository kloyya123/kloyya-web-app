import type { Metadata } from 'next';
import { SettingsView } from '@/features/settings/components/settings-view';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'How Kloyya works for you.',
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return <SettingsView />;
}
