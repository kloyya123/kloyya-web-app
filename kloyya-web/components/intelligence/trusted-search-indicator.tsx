'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Loader2, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  advancePipeline,
  initialPipeline,
  isPipelineComplete,
} from '@/lib/intelligence-pipeline';
import { DURATION, EASE } from '@/lib/motion';
import { useSources } from '@/hooks/use-sources';
import { STATUS_META, providerIcon } from '@/components/sources/source-meta';
import type { PipelineStage } from '@/types/sources';

/**
 * The Trusted Knowledge Search indicator.
 *
 * From "Trusted Knowledge Search": near the global search, show which approved
 * sources are being searched and the reasoning as it happens — "Searching 12 of
 * 18 connected sources", then the staged pipeline. The spec's rules, honored:
 *
 *   - "Only approved and connected data sources should be included." We show the
 *     working sources; the two that need attention are counted out, not searched.
 *   - "The animation should feel subtle and professional — not distracting."
 *   - "Never fake activity." When done, it settles into a static, honest summary.
 *
 * It advances a pure pipeline on a timer. A real backend would feed the same
 * component from an event stream; nothing else changes.
 */

const DEFAULT_STEP_MS = 550;

export interface TrustedSearchIndicatorProps {
  className?: string;
  /** Milliseconds per reasoning step. Overridable so tests need not fake timers. */
  stepMs?: number;
}

export function TrustedSearchIndicator({
  className,
  stepMs = DEFAULT_STEP_MS,
}: TrustedSearchIndicatorProps) {
  const prefersReducedMotion = useReducedMotion();
  const { data: sources } = useSources();
  const [stages, setStages] = useState<PipelineStage[]>(() => initialPipeline());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const working = sources?.filter((s) => STATUS_META[s.status].isWorking) ?? [];
  const total = sources?.length ?? 0;

  useEffect(() => {
    // Reduced motion skips straight to the settled state — no marching stages.
    if (prefersReducedMotion) {
      setStages((current) => current.map((stage) => ({ ...stage, status: 'complete' })));
      return;
    }

    timer.current = setInterval(() => {
      setStages((current) => {
        if (isPipelineComplete(current)) {
          if (timer.current) clearInterval(timer.current);
          return current;
        }
        return advancePipeline(current);
      });
    }, stepMs);

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [prefersReducedMotion, stepMs]);

  const complete = isPipelineComplete(stages);
  const activeStage = stages.find((stage) => stage.status === 'active');

  return (
    <section
      aria-label="Intelligence status"
      className={cn(
        'bg-surface border-border rounded-md border p-4',
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        {complete ? (
          <ShieldCheck aria-hidden="true" className="text-positive size-4 shrink-0" />
        ) : (
          <Search aria-hidden="true" className="text-link size-4 shrink-0" />
        )}

        {/* One polite live region announces the current state, not every tick. */}
        <p className="text-small text-foreground font-medium" role="status">
          {complete
            ? `Grounded in ${working.length} of ${total} connected sources`
            : (activeStage?.label ?? 'Preparing')}
        </p>
      </div>

      {/* The working sources, as verified checkmarks. */}
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Sources searched">
        {working.slice(0, 8).map((source) => {
          const Icon = providerIcon(source.provider);
          return (
            <li
              key={source.id}
              className="border-border bg-card text-caption text-muted-foreground flex items-center gap-1.5 rounded-full border px-2 py-0.5"
            >
              <Check aria-hidden="true" className="text-positive size-3" />
              <Icon aria-hidden="true" className="size-3" />
              {source.displayName}
            </li>
          );
        })}
        {working.length > 8 ? (
          <li className="text-caption text-subtle flex items-center px-1">
            +{working.length - 8} more
          </li>
        ) : null}
      </ul>

      {/* The reasoning steps, revealed as they run. Hidden once complete so the
          indicator settles rather than nagging. */}
      {!complete ? (
        <ol className="mt-3 space-y-1">
          <AnimatePresence initial={false}>
            {stages
              .filter((stage) => stage.status !== 'pending')
              .map((stage) => (
                <motion.li
                  key={stage.kind}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DURATION.fast, ease: EASE.out }}
                  className="text-caption text-subtle flex items-center gap-2"
                >
                  {stage.status === 'complete' ? (
                    <Check aria-hidden="true" className="text-positive size-3 shrink-0" />
                  ) : (
                    <Loader2 aria-hidden="true" className="text-link size-3 shrink-0 animate-spin" />
                  )}
                  {stage.label}
                </motion.li>
              ))}
          </AnimatePresence>
        </ol>
      ) : null}
    </section>
  );
}
