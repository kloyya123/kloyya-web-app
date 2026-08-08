'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogoMark } from '@/components/brand/logo';
import { Progress } from '@/components/ui';
import { cn } from '@/lib/cn';
import { DURATION, EASE } from '@/lib/motion';

/**
 * Workspace initialization — the replacement for a splash screen.
 *
 * Design Manifesto: "Never show meaningless spinners… Analyzing your workspace…
 * Connecting project context… Preparing today's briefing."
 *
 * Each stage names a real thing Kloyya will do once a backend exists. The
 * durations below are the mock; the stage list is the contract. When the real
 * pipeline lands, `STAGES` stays and the timer is replaced by progress events.
 */
const STAGES = [
  { id: 'workspace', label: 'Creating your workspace', ms: 900 },
  { id: 'ai', label: 'Personalizing your AI', ms: 1100 },
  { id: 'connect', label: 'Connecting your workspace', ms: 800 },
  { id: 'graph', label: 'Building your Knowledge Graph', ms: 1400 },
  { id: 'recommendations', label: 'Preparing recommendations', ms: 1000 },
  { id: 'dashboard', label: 'Loading your dashboard', ms: 700 },
] as const;

type StageStatus = 'pending' | 'active' | 'complete';

export function WorkspaceInit() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const stage = STAGES[activeIndex];

    // All stages done: hand off to the dashboard. `replace` so Back does not
    // walk the user back into a loading screen that would run again.
    if (!stage) {
      // The one real signal that this is a brand-new workspace, not just a
      // browser that has never visited /dashboard before. The dashboard reads
      // and clears this itself — see useDashboardIntroState.
      sessionStorage.setItem('kloyya:just-onboarded', 'true');
      router.replace('/dashboard');
      return;
    }

    const timer = setTimeout(() => setActiveIndex((index) => index + 1), stage.ms);
    return () => clearTimeout(timer);
  }, [activeIndex, router]);

  const completed = Math.min(activeIndex, STAGES.length);
  const progress = (completed / STAGES.length) * 100;
  const currentLabel = STAGES[activeIndex]?.label ?? 'Ready';

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center px-4 py-12">
      <main id="main" className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          {/*
            The mark breathes rather than spins. A spinner says "waiting";
            a slow pulse says "working". Reduced motion stops it entirely.

            Spread conditionally rather than passing `animate={undefined}` —
            Framer treats an explicit undefined as an invalid target, not as
            "no animation".
          */}
          <motion.div
            {...(prefersReducedMotion
              ? {}
              : {
                  animate: { opacity: [1, 0.55, 1] },
                  transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
                })}
          >
            <LogoMark className="size-12" />
          </motion.div>

          <div className="space-y-1">
            <h1 className="text-title text-foreground font-semibold">
              Setting up Kloyya
            </h1>
            <p className="text-small text-muted-foreground">
              This takes a moment. Kloyya is reading your work, not just your settings.
            </p>
          </div>
        </div>

        <Progress value={progress} label={currentLabel} className="mb-8" />

        {/*
          One live region for the whole list. Announcing each row as it changes
          would read six separate messages; `aria-live="polite"` on the container
          with the current stage as its text says one useful thing at a time.
        */}
        <ol className="space-y-3" aria-live="polite" aria-busy={activeIndex < STAGES.length}>
          {STAGES.map((stage, index) => {
            const status: StageStatus =
              index < activeIndex ? 'complete' : index === activeIndex ? 'active' : 'pending';
            return <StageRow key={stage.id} label={stage.label} status={status} />;
          })}
        </ol>
      </main>
    </div>
  );
}

function StageRow({ label, status }: { label: string; status: StageStatus }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <li className="flex items-center gap-3">
      <span className="flex size-5 shrink-0 items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {status === 'complete' ? (
            <motion.span
              key="complete"
              {...(prefersReducedMotion ? {} : { initial: { scale: 0.6, opacity: 0 } })}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: DURATION.fast, ease: EASE.out }}
              className="bg-success/15 text-positive flex size-5 items-center justify-center rounded-full"
            >
              <Check aria-hidden="true" className="size-3" />
            </motion.span>
          ) : status === 'active' ? (
            <Loader2
              key="active"
              aria-hidden="true"
              className="text-link size-4 animate-spin"
            />
          ) : (
            <span
              key="pending"
              aria-hidden="true"
              className="border-border size-2 rounded-full border-2"
            />
          )}
        </AnimatePresence>
      </span>

      <span
        className={cn(
          'text-small transition-colors duration-300',
          status === 'pending' && 'text-subtle',
          status === 'active' && 'text-foreground font-medium',
          status === 'complete' && 'text-muted-foreground',
        )}
      >
        {label}
      </span>

      {/* Only the active stage is announced, and only once. */}
      {status === 'active' ? <span className="sr-only">In progress</span> : null}
    </li>
  );
}
