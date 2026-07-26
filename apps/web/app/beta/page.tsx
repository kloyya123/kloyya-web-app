import type { Metadata } from 'next';
import { BetaWall } from '@/features/landing/components/beta-wall';

/**
 * Where a signed-in account that is not on the private-beta allowlist is held.
 *
 * Reached only by middleware redirect. Deliberately `noindex`: it is a holding
 * page for a closed beta, not something that should appear in search results
 * next to the marketing page.
 */
export const metadata: Metadata = {
  title: 'Kloyya is in private beta',
  description: 'Kloyya is currently invitation-only.',
  robots: { index: false, follow: false },
};

export default function BetaPage() {
  return <BetaWall />;
}
