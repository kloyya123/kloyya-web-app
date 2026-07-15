import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RecommendationFeed } from '@/features/recommendations/components/recommendation-feed';

export const metadata: Metadata = {
  title: 'Recommendations',
  description: 'Evidence-backed recommendations, ranked by decision score.',
  robots: { index: false, follow: false },
};

// The priority filter lives in the URL, and useSearchParams requires a Suspense
// boundary above it.
export default function RecommendationsPage() {
  return (
    <Suspense fallback={null}>
      <RecommendationFeed />
    </Suspense>
  );
}
