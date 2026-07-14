import type { ReactNode } from 'react';

/**
 * Onboarding and workspace initialization share no chrome with the app shell:
 * there is no sidebar to navigate to, and no workspace to switch between, until
 * these steps finish. Each screen owns its own full-height layout.
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
