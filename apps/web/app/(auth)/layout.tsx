import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';

/**
 * The authentication shell.
 *
 * A single centred column, no marketing, no illustration. The Design Manifesto
 * asks that the product feel "Calm. Focused. In control." from the first screen;
 * a split-panel hero with a testimonial would be arguing when it should be
 * getting out of the way.
 *
 * The mission statement sits below the card rather than above it: it is the
 * reason the user is here, not an instruction.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <main id="main" className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        {children}

        <p className="text-caption text-subtle mt-8 text-center">
          The Intelligence Behind Every Decision.
        </p>
      </main>
    </div>
  );
}
