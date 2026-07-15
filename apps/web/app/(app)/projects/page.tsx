import type { Metadata } from 'next';
import { ProjectsBoard } from '@/features/projects/components/projects-board';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Every project, health-ranked, with the AI reasoning behind each score.',
  robots: { index: false, follow: false },
};

export default function ProjectsPage() {
  return <ProjectsBoard />;
}
