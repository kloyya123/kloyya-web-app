import type { Metadata } from 'next';
import { Logo } from '@/components/brand/logo';
import { OnboardingConnectStep } from '@/features/connections/components/onboarding-connect-step';

export const metadata: Metadata = {
  title: 'Connect your tools',
  description: 'Bring your work into Kloyya before your workspace is created.',
  robots: { index: false, follow: false },
};

export default function ConnectToolsPage() {
  return (
    <div className="bg-background flex min-h-dvh flex-col items-center px-4 py-12">
      <main id="main" className="w-full max-w-2xl">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <OnboardingConnectStep />
      </main>
    </div>
  );
}
