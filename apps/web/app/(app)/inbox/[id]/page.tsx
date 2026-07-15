import type { Metadata } from 'next';
import { EmailDetail } from '@/features/inbox/components/email-detail';

export const metadata: Metadata = {
  title: 'Email',
  robots: { index: false, follow: false },
};

export default async function EmailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EmailDetail id={id} />;
}
