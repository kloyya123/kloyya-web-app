import type { Metadata } from 'next';
import { WorkspaceInit } from '@/features/onboarding/components/workspace-init';

export const metadata: Metadata = {
  title: 'Setting up Kloyya',
  robots: { index: false, follow: false },
};

export default function WorkspaceInitPage() {
  return <WorkspaceInit />;
}
