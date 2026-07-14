import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NotificationsView } from '@/features/notifications/components/notifications-view';

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Ranked by what matters, not by what arrived last.',
  robots: { index: false, follow: false },
};

// The unread filter lives in the URL, and useSearchParams requires a Suspense
// boundary above it.
export default function NotificationsPage() {
  return (
    <Suspense fallback={null}>
      <NotificationsView />
    </Suspense>
  );
}
