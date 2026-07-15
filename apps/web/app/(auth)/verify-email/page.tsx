import type { Metadata } from 'next';
import { VerifyEmailForm } from '@/features/auth/components/verify-email-form';

export const metadata: Metadata = {
  title: 'Verify your email',
  description: 'Verify your email address to secure your Kloyya workspace.',
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return <VerifyEmailForm />;
}
