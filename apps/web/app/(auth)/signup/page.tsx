import type { Metadata } from 'next';
import { SignUpForm } from '@/features/auth/components/signup-form';

export const metadata: Metadata = {
  title: 'Sign up',
  description:
    'Create your Kloyya workspace free. Connect Gmail, Calendar, Drive, and Notion, and get your first briefing.',
  // Indexed for the same reason as /login — see the note there.
  robots: { index: true, follow: true },
  alternates: { canonical: '/signup' },
};

export default function SignUpPage() {
  return <SignUpForm />;
}
