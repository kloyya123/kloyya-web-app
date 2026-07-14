import type { Metadata } from 'next';
import { ArticleDetail } from '@/features/knowledge/components/article-detail';

export const metadata: Metadata = {
  title: 'Article',
  robots: { index: false, follow: false },
};

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ArticleDetail id={id} />;
}
