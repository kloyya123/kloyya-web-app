import type { Metadata } from 'next';
import { WaitlistWall } from '@/features/landing/components/waitlist-wall';

/**
 * Where a signed-in account that is not on the access allowlist is held.
 *
 * Reached only by middleware redirect. `noindex`: it describes one account's
 * state, not something that belongs in search results.
 */
export const metadata: Metadata = {
  title: 'You’re on the waitlist',
  description: 'Your Kloyya access is not active yet.',
  robots: { index: false, follow: false },
};

export default function WaitlistPage() {
  return <WaitlistWall />;
}
