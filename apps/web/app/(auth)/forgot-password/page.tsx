import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';

export const metadata: Metadata = {
  title: 'Reset your password',
  description: 'Reset your Kloyya password.',
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Set by app/auth/confirm/route.ts when a recovery link has already been
  // used or has expired — never anything else, so no need to validate value.
  const expired = params.status === 'expired';

  return <ForgotPasswordForm expiredLink={expired} />;
}
