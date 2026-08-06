'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { NAV_ITEMS } from '@/components/layout/nav-items';
import { integrationIcon } from '@/features/connections/integration-meta';
import { cn } from '@/lib/cn';
import { AppWindow, BriefRow, Flag, PanelHead, TitleBar } from './app-chrome';

/**
 * The real desktop shell — actual nav items, actual icons, actual Kloyya
 * wordmark, imported from the same file the signed-in sidebar reads. Only the
 * data behind each screen is a mock; the chrome around it is not. Colors come
 * from the `.mockup` palette (tokens.css), not the product's own KDS tokens —
 * see AppWindow in app-chrome.tsx for why they're kept deliberately separate.
 */
const SHELL_NAV = NAV_ITEMS.slice(0, 8);

function DesktopShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <AppWindow className="flex h-full">
      <aside className="hidden w-44 shrink-0 flex-col border-r border-[var(--mockup-border)] bg-[var(--mockup-surface)] px-3 py-3 sm:flex">
        <div className="mb-4 px-1">
          <Logo className="h-4 w-auto" />
        </div>
        <nav className="flex flex-col gap-0.5">
          {SHELL_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.label === active;
            return (
              <span
                key={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-sm px-2 py-1.5 text-caption',
                  isActive
                    ? 'bg-[var(--mockup-accent)]/12 font-medium text-[var(--mockup-accent)]'
                    : 'text-[var(--mockup-ink-soft)]',
                )}
              >
                <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </AppWindow>
  );
}

/**
 * Three tabbed mockups of the product. Every row is a concrete example rather
 * than lorem: a visitor should be able to tell what the screen does without
 * signing up, and nothing shown here is a feature the app lacks.
 */

type ScreenId = 'home' | 'inbox' | 'calendar';

const TABS: { id: ScreenId; label: string; caption: string }[] = [
  { id: 'home', label: 'Home', caption: 'The day ranked, drafts waiting, one box to ask anything.' },
  { id: 'inbox', label: 'Inbox', caption: 'Sorted by who is waiting on you, not by what arrived last.' },
  { id: 'calendar', label: 'Calendar', caption: 'Every meeting arrives with its context already gathered.' },
];

export function ProductScreens() {
  const [active, setActive] = useState<ScreenId>('home');
  const prefersReducedMotion = useReducedMotion();
  const caption = TABS.find((tab) => tab.id === active)?.caption;

  return (
    <div>
      <div role="tablist" aria-label="Kloyya screens" className="mb-7 flex flex-wrap border-b border-[var(--mockup-border)]">
        {TABS.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`screen-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={cn(
                '-mb-px border-b-2 px-4 py-2.5 text-caption font-mono tracking-widest uppercase transition-colors first:pl-0',
                selected
                  ? 'border-[var(--mockup-accent)] text-[var(--mockup-accent)]'
                  : 'border-transparent text-[var(--mockup-ink-soft)] hover:text-[var(--mockup-ink)]',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active}
          id={`screen-${active}`}
          role="tabpanel"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          {...(prefersReducedMotion ? {} : { exit: { opacity: 0, y: -8 } })}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {active === 'home' ? <HomeScreen /> : null}
          {active === 'inbox' ? <InboxScreen /> : null}
          {active === 'calendar' ? <CalendarScreen /> : null}
        </motion.div>
      </AnimatePresence>

      <p className="mt-3 text-caption font-mono text-[var(--mockup-ink-soft)]">{caption}</p>
    </div>
  );
}

function Kpi({
  label,
  value,
  note,
  hot,
}: {
  label: string;
  value: string;
  note: string;
  hot?: boolean;
}) {
  return (
    <div className="border-r border-[var(--mockup-border)]/60 px-4 py-3 last:border-r-0">
      <div className="text-caption font-mono tracking-widest text-[var(--mockup-ink-soft)] uppercase">{label}</div>
      <div className="mt-1 text-heading-s font-semibold text-[var(--mockup-ink)] tabular-nums">{value}</div>
      <div
        className={cn(
          'text-caption font-mono',
          hot ? 'text-[var(--mockup-caution)]' : 'text-[var(--mockup-ink-soft)]',
        )}
      >
        {note}
      </div>
    </div>
  );
}

/** Exported so the hero can use it as the backdrop behind the header — see Hero() in landing-page.tsx. */
export function HomeScreen() {
  return (
    <DesktopShell active="Home">
      <TitleBar label="kloyya.com/dashboard" status="Tue 26" />

      <div className="grid grid-cols-2 border-b border-[var(--mockup-border)] sm:grid-cols-4">
        <Kpi label="Events" value="5" note="2 need prep" />
        <Kpi label="Tasks due" value="8" note="3 high priority" hot />
        <Kpi label="Unread" value="213" note="4 need you" />
        <Kpi label="Focus left" value="4.5h" note="56% of day" />
      </div>

      <div className="px-4 py-4">
        <div className="mb-3 flex items-center gap-3 rounded-sm border border-[var(--mockup-border)] bg-[var(--mockup-bg)] px-3 py-2.5">
          <span className="flex-1 text-small text-[var(--mockup-ink-soft)]">Ask Kloyya anything about your work…</span>
          <span className="rounded-sm border border-[var(--mockup-accent)] px-2 py-0.5 text-caption font-mono text-[var(--mockup-accent)]">
            ↵ Ask
          </span>
        </div>

        <BriefRow when="Now" meta="written from your hiring plan">
          <Flag>Draft ready</Flag>
          Reply to Dana on hiring pace — review and send
        </BriefRow>
        <BriefRow when="Today" meta="Q3 Forecast v9 · edited 22:14">
          Slide 7 contradicts the current forecast
        </BriefRow>
        <BriefRow when="Today" meta="no action needed" last>
          <Flag tone="handled">Good</Flag>
          Atlas shipped two days early
        </BriefRow>
      </div>
    </DesktopShell>
  );
}

/** Exported for the "What it does" feature rows, and the hero — real inbox rows, not a condensed list. */
export function InboxScreen() {
  return (
    <DesktopShell active="Inbox">
      <TitleBar label="kloyya.com/inbox" status="4 / 213" />
      <div className="px-4 py-4">
        <PanelHead left="Needs you" right="209 held back" />

        <BriefRow when="2d" meta="approve to send, or edit first">
          <Flag>Draft ready</Flag>
          Amara Osei — vendor contract, reply written
        </BriefRow>
        <BriefRow when="4d" meta="she is on today’s 09:00 invite">
          <Flag>Owed</Flag>
          Dana Whitfield — “what is our hiring pace looking like?”
        </BriefRow>
        <BriefRow when="9h" meta="deck not updated · Kloyya cross-checked">
          Priya Raman — Q3 forecast v9 is final
        </BriefRow>
        <BriefRow when="1d" meta="deadline detected in the message">
          Legal — MSA redlines, review by Thursday
        </BriefRow>
        <BriefRow when="—" meta="out of your way, one search away" last>
          <Flag tone="handled">Quiet</Flag>
          209 newsletters, CCs and receipts
        </BriefRow>
      </div>
    </DesktopShell>
  );
}

/** Exported for the "What it does" feature rows — see landing-page.tsx. */
export function CalendarScreen() {
  return (
    <DesktopShell active="Calendar">
      <TitleBar label="kloyya.com/calendar" status="Tue 26 Jul" />
      <div className="px-4 py-4">
        <PanelHead left="Today" right="4.5h unbooked" />

        <BriefRow when="09:00" meta="briefing ready · 3 changes since the deck went out">
          <Flag>Prep</Flag>
          Board sync · 6 attendees
        </BriefRow>
        <BriefRow when="10:00" meta="declined two invites, with your standing permission">
          <Flag tone="handled">Held</Flag>
          Focus block
        </BriefRow>
        <BriefRow when="11:30" meta="open item: vendor contract">
          One-to-one with Amara · 30m
        </BriefRow>
        <BriefRow when="14:00" meta="Kloyya: a summary could replace this one">
          Atlas retro · 8 attendees
        </BriefRow>
        <BriefRow when="16:00" meta="protected" last>
          <Flag tone="handled">Held</Flag>
          Focus block
        </BriefRow>
      </div>
    </DesktopShell>
  );
}

/** For the "Replies on your behalf" feature row — landing-page.tsx. */
export function ReplyScreen() {
  return (
    <DesktopShell active="Drafts">
      <TitleBar label="kloyya.com/drafts" status="awaiting you" />
      <div className="px-4 py-4">
        <PanelHead left="Re: vendor contract" right="written from the thread" />
        <p className="text-small leading-relaxed text-[var(--mockup-ink)]">
          Hi Amara — sorry for the delay. The redlines are attached; Legal signed off on sections 2
          and 4, and flagged the liability cap in section 7 for your review. Let me know if Thursday
          still works to close this out.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <span className="rounded-sm bg-[var(--mockup-accent)] px-3 py-1.5 text-caption font-semibold text-[var(--mockup-on-accent)]">
            Send
          </span>
          <span className="rounded-sm border border-[var(--mockup-border)] px-3 py-1.5 text-caption font-semibold text-[var(--mockup-ink-soft)]">
            Edit first
          </span>
          <span className="ml-auto text-caption font-mono text-[var(--mockup-ink-soft)]">nothing sends without you</span>
        </div>
      </div>
    </DesktopShell>
  );
}

/** For the "Remembers your documents" feature row — landing-page.tsx. */
export function DocumentsScreen() {
  return (
    <DesktopShell active="Documents">
      <TitleBar label="kloyya.com/documents" status="128 indexed" />
      <div className="px-4 py-4">
        <PanelHead left="Recently connected" right="synced from Drive + Notion" />

        <BriefRow when="Now" meta="Q3 Forecast v9 · used in this morning’s briefing">
          <Flag>Referenced</Flag>
          Q3 Forecast v9.xlsx
        </BriefRow>
        <BriefRow when="2d" meta="linked to the vendor contract thread">
          MSA redlines — Legal.docx
        </BriefRow>
        <BriefRow when="4d" meta="cross-checked against the deck Priya sent" last>
          <Flag tone="handled">Cross-checked</Flag>
          Hiring plan — Notion
        </BriefRow>
      </div>
    </DesktopShell>
  );
}

/** For the "Answers in plain language" feature row — landing-page.tsx. */
export function AskScreen() {
  return (
    <DesktopShell active="Ask Kloyya">
      <TitleBar label="kloyya.com/ask" status="answered in 2.8s" />
      <div className="px-4 py-4">
        <div className="mb-3 flex items-center gap-3 rounded-sm border border-[var(--mockup-border)] bg-[var(--mockup-bg)] px-3 py-2.5">
          <span className="flex-1 text-small text-[var(--mockup-ink)]">Who is blocked on the vendor contract?</span>
        </div>
        <p className="text-small leading-relaxed text-[var(--mockup-ink)]">
          Amara Osei — she is waiting on the redline you sent Legal two days ago. A reply is already
          drafted and waiting for your approval.
        </p>
        <div className="mt-3 border-t border-[var(--mockup-border)]/60 pt-2">
          <span className="text-caption font-mono tracking-widest text-[var(--mockup-ink-soft)] uppercase">Sources</span>
          <p className="mt-1 text-caption font-mono text-[var(--mockup-ink-soft)]">
            Vendor contract thread · MSA redlines.docx · Legal calendar hold
          </p>
        </div>
      </div>
    </DesktopShell>
  );
}

/**
 * The same Ask exchange as AskScreen, but played out step by step — the
 * question lands, Kloyya searches the workspace, the sources it found appear
 * one at a time, then the answer. Motion carrying the actual mechanism
 * ("search your own data, then answer from it") rather than decoration on
 * top of a static screen. Plays once when scrolled into view; reduced motion
 * skips straight to the finished state.
 */
const ASK_SOURCES = ['Vendor contract thread', 'MSA redlines.docx', 'Legal calendar hold'];

export function AskMotion() {
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<'question' | 'searching' | 'sources' | 'answer'>(
    prefersReducedMotion ? 'answer' : 'question',
  );
  const [sourceCount, setSourceCount] = useState(prefersReducedMotion ? ASK_SOURCES.length : 0);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase('searching'), 700));
    timers.push(setTimeout(() => setPhase('sources'), 1500));
    ASK_SOURCES.forEach((_, i) => {
      timers.push(setTimeout(() => setSourceCount((n) => Math.max(n, i + 1)), 1900 + i * 450));
    });
    timers.push(setTimeout(() => setPhase('answer'), 1900 + ASK_SOURCES.length * 450 + 400));
    return () => timers.forEach(clearTimeout);
  }, [prefersReducedMotion]);

  const GmailIcon = integrationIcon('gmail', 'communication');

  return (
    <DesktopShell active="Ask Kloyya">
      <TitleBar label="kloyya.com/ask" status={phase === 'answer' ? 'answered in 2.8s' : 'thinking…'} />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 px-4 py-4">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-3 flex items-center gap-3 rounded-sm border border-[var(--mockup-border)] bg-[var(--mockup-bg)] px-3 py-2.5"
          >
            <span className="flex-1 text-small text-[var(--mockup-ink)]">Who is blocked on the vendor contract?</span>
          </motion.div>

          <AnimatePresence>
            {phase === 'searching' || phase === 'sources' ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-2 text-caption font-mono text-[var(--mockup-ink-soft)]"
              >
                Searching your workspace…
              </motion.p>
            ) : null}
          </AnimatePresence>

          {phase === 'sources' ? (
            <ul className="mb-2 flex flex-col gap-1.5">
              {ASK_SOURCES.slice(0, sourceCount).map((source) => (
                <motion.li
                  key={source}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25 }}
                  className="text-caption font-mono text-[var(--mockup-ink-soft)]"
                >
                  · {source}
                </motion.li>
              ))}
            </ul>
          ) : null}

          {phase === 'answer' ? (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-small leading-relaxed text-[var(--mockup-ink)]">
                Amara Osei — she is waiting on the redline you sent Legal two days ago. A reply is
                already drafted and waiting for your approval.
              </p>
              <div className="mt-3 border-t border-[var(--mockup-border)]/60 pt-2">
                <span className="text-caption font-mono tracking-widest text-[var(--mockup-ink-soft)] uppercase">Sources</span>
                <p className="mt-1 text-caption font-mono text-[var(--mockup-ink-soft)]">{ASK_SOURCES.join(' · ')}</p>
              </div>
            </motion.div>
          ) : null}
        </div>

        {/* The source itself, previewed — not just named. Real icon, real
            provider, so the answer's citation is something you can check. */}
        <AnimatePresence>
          {phase === 'sources' || phase === 'answer' ? (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="hidden w-48 shrink-0 border-l border-[var(--mockup-border)] bg-[var(--mockup-surface)] p-3 sm:block"
            >
              <div className="flex items-center gap-2 rounded-sm border border-[var(--mockup-border)] bg-[var(--mockup-card)] p-2">
                <GmailIcon aria-hidden="true" className="size-4 shrink-0 text-[var(--mockup-accent)]" />
                <span className="truncate text-caption font-medium text-[var(--mockup-ink)]">Gmail</span>
              </div>
              <p className="mt-2 text-caption leading-snug text-[var(--mockup-ink-soft)]">
                Re: vendor contract — Amara Osei, 2 days ago
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </DesktopShell>
  );
}

/**
 * The hero's own screen — a centered Ask, and the real Inbox underneath it
 * (the same rows InboxScreen shows, not a condensed stand-in), the way
 * opening a new tab shows what's already in motion rather than a blank page.
 */
export function HeroBriefing(): ReactNode {
  return (
    <DesktopShell active="Home">
      <TitleBar label="kloyya.com" status="07:42" />
      <div className="flex flex-col items-center px-6 pt-8 pb-2">
        <div className="flex w-full max-w-md items-center gap-2 rounded-full border border-[var(--mockup-border)] bg-[var(--mockup-bg)] px-4 py-2.5 shadow-sm">
          <span className="flex-1 text-left text-small text-[var(--mockup-ink-soft)]">Ask Kloyya anything about your work…</span>
          <span className="rounded-full bg-[var(--mockup-accent)] px-3 py-1 text-caption font-semibold text-[var(--mockup-on-accent)]">
            Ask
          </span>
        </div>
      </div>

      <div className="px-4 pt-4 pb-4">
        <PanelHead left="Inbox" right="4 of 213 reviewed" />

        <BriefRow when="2d" meta="approve to send, or edit first">
          <Flag>Draft ready</Flag>
          Amara Osei — vendor contract, reply written
        </BriefRow>
        <BriefRow when="4d" meta="she is on today’s 09:00 invite">
          <Flag>Owed</Flag>
          Dana Whitfield — “what is our hiring pace looking like?”
        </BriefRow>
        <BriefRow when="9h" meta="deck not updated · Kloyya cross-checked" last>
          Priya Raman — Q3 forecast v9 is final
        </BriefRow>
      </div>
    </DesktopShell>
  );
}
