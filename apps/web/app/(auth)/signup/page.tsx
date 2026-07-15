import type { Metadata } from 'next';
import { SignUpForm } from '@/features/auth/components/signup-form';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Create your Kloyya workspace.',
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return <SignUpForm />;
}
