import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchView } from '@/features/search/components/search-view';

export const metadata: Metadata = {
  title: 'Search',
  description: 'One query across everything Kloyya knows.',
  robots: { index: false, follow: false },
};

// SearchView reads ?q= via useSearchParams, which requires a Suspense boundary.
export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchView />
    </Suspense>
  );
}
