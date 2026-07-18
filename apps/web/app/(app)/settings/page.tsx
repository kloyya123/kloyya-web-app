import type { Metadata } from 'next';
import { CommunityFeedback } from '@/features/settings/components/community-feedback';
import { SettingsView } from '@/features/settings/components/settings-view';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'How Kloyya works for you.',
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return (
    <div className="space-y-10">
      <SettingsView />
      <section aria-label="Community and feedback">
        <CommunityFeedback />
      </section>
    </div>
  );
}
