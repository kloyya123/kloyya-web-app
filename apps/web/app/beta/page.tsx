import type { Metadata } from 'next';
import { BetaWall } from '@/features/landing/components/beta-wall';

/**
 * Where a signed-in account that is not yet on the access allowlist is held.
 *
 * Reached only by middleware redirect. Deliberately `noindex`: it is a holding
 * page for one account's state, not something that should appear in search
 * results next to the marketing page.
 */
export const metadata: Metadata = {
  title: 'Access pending',
  description: 'Your Kloyya access is not active yet.',
  robots: { index: false, follow: false },
};

export default function BetaPage() {
  return <BetaWall />;
}
