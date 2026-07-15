import type { Metadata } from 'next';
import { Suspense } from 'react';
import { KnowledgeBase } from '@/features/knowledge/components/knowledge-base';

export const metadata: Metadata = {
  title: 'Knowledge',
  description: 'Curated decisions and playbooks, and the graph that connects them.',
  robots: { index: false, follow: false },
};

// The view and category filters live in the URL, and useSearchParams requires a
// Suspense boundary above it.
export default function KnowledgePage() {
  return (
    <Suspense fallback={null}>
      <KnowledgeBase />
    </Suspense>
  );
}
