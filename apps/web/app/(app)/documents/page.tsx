import type { Metadata } from 'next';
import { DocumentsView } from '@/features/documents/components/documents-view';

export const metadata: Metadata = {
  title: 'Documents',
  description: 'Upload files so Kloyya can search and answer from them.',
  robots: { index: false, follow: false },
};

export default function DocumentsPage() {
  return <DocumentsView />;
}
