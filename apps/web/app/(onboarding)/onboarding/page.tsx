import type { Metadata } from 'next';
import { Logo } from '@/components/brand/logo';
import { OnboardingWizard } from '@/features/onboarding/components/onboarding-wizard';

export const metadata: Metadata = {
  title: 'Set up your workspace',
  description: 'Tell Kloyya about your work so it can prepare your day.',
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return (
    <div className="bg-background flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <main id="main" className="w-full max-w-lg">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <OnboardingWizard />
      </main>
    </div>
  );
}
