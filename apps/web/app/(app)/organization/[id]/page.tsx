import type { Metadata } from 'next';
import { MemberProfile } from '@/features/organization/components/member-profile';

export const metadata: Metadata = {
  title: 'Member',
  robots: { index: false, follow: false },
};

export default async function MemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MemberProfile id={id} />;
}
