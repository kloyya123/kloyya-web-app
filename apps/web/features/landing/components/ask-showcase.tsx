'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { AppWindow, BriefRow, Flag, PanelHead, TitleBar } from './app-chrome';

/**
 * Ask Kloyya, played out rather than shown static — the question lands,
 * Kloyya searches, then answers with its sources named. The mechanism the
 * product actually has (retrieve, then answer — never the other way around),
 * not a decorative loop. Plays once when scrolled into view; reduced motion
 * skips straight to the finished state. Reuses the vendor-contract example
 * already established across this site's other mockups.
 *
 * `compact` drops the document-review side panel for narrow placements (the
 * auth screen's side rail) where a two-column layout would fight the
 * container rather than fit it.
 */
export function AskShowcaseCard({ compact = false }: { compact?: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<'question' | 'thinking' | 'answer'>(
    prefersReducedMotion ? 'answer' : 'question',
  );

  useEffect(() => {
    if (prefersReducedMotion) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase('thinking'), 700));
    timers.push(setTimeout(() => setPhase('answer'), 2100));
    return () => timers.forEach(clearTimeout);
  }, [prefersReducedMotion]);

  return (
    <AppWindow className={cn('flex flex-col', !compact && 'sm:flex-row')}>
      <div className="min-w-0 flex-1 p-5">
        <TitleBar label="kloyya.com/ask" status={phase === 'answer' ? 'answered in 2.8s' : 'thinking…'} />

        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-4 flex items-start gap-2"
        >
          <span className="rounded-2xl bg-[var(--mockup-accent)] px-3.5 py-2 text-small text-[var(--mockup-on-accent)]">
            Who is blocked on the vendor contract?
          </span>
        </motion.div>

        {phase === 'thinking' ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-caption font-mono text-[var(--mockup-ink-soft)]"
          >
            Searching your workspace…
          </motion.p>
        ) : null}

        {phase === 'answer' ? (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3 rounded-2xl border border-[var(--mockup-border)] bg-[var(--mockup-bg)] p-3.5"
          >
            <p className="text-small leading-relaxed text-[var(--mockup-ink)]">
              Amara Osei — she&rsquo;s waiting on the redline you sent Legal two days ago. A reply
              is already drafted and waiting for your approval.
            </p>
            <p className="mt-2 text-caption font-mono text-[var(--mockup-ink-soft)]">
              Sources: vendor contract thread · MSA redlines.docx · Legal calendar hold
            </p>
          </motion.div>
        ) : null}

        {!compact && phase === 'answer' ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {['What are my top priorities today?', 'Summarize my last meeting', 'Show me unread emails'].map(
              (chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[var(--mockup-border)] px-3 py-1.5 text-caption text-[var(--mockup-ink-soft)]"
                >
                  {chip}
                </span>
              ),
            )}
          </div>
        ) : null}
      </div>

      {!compact && phase === 'answer' ? (
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full shrink-0 border-t border-[var(--mockup-border)] bg-[var(--mockup-surface)] p-5 sm:w-72 sm:border-t-0 sm:border-l"
        >
          <PanelHead left="Reviewing" right="1 document" />
          <BriefRow when="Now" meta="MSA redlines.docx" last>
            <Flag>Referenced</Flag>
            Legal — vendor contract
          </BriefRow>
        </motion.div>
      ) : null}
    </AppWindow>
  );
}
