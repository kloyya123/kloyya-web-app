import type { Metadata } from 'next';
import { ProjectDetail } from '@/features/projects/components/project-detail';

export const metadata: Metadata = {
  title: 'Project',
  robots: { index: false, follow: false },
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectDetail id={id} />;
}
