import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { TodayMotion } from '@/features/landing/components/product-screens';

/**
 * The authentication shell — split panel, by request.
 *
 * Left: the real form, centred, no distraction. Right: one screen — Today,
 * the dashboard the person is about to land on, arriving stat by stat and
 * card by card. Same animated component the landing page's hero uses. It
 * bleeds off the top and right edges of its own panel rather than sitting
 * centred with margin on every side — a screen caught mid-use, not a framed
 * product shot. Hidden below `md` (768px): a narrow window has no room for a
 * second panel, and the form is what matters there.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <main id="main" className="bg-background flex w-full flex-col items-center justify-center px-4 py-12 md:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <Logo />
          </div>

          {children}

          <p className="text-caption text-subtle mt-8 text-center">
            The Intelligence Behind Every Decision.
          </p>
        </div>
      </main>

      <div
        aria-hidden="true"
        className="relative hidden overflow-hidden md:block md:w-1/2"
        style={{
          background:
            'radial-gradient(70% 60% at 30% -10%, #cfe3ff, transparent 65%), radial-gradient(60% 50% at 80% 100%, #a9cdff, transparent 60%), linear-gradient(160deg, #eaf2ff, #ffffff)',
        }}
      >
        <div className="absolute top-16 -right-16 w-[34rem] shadow-2xl">
          <TodayMotion />
        </div>
      </div>
    </div>
  );
}
