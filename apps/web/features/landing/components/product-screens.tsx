'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { AppWindow, BriefRow, Flag, PanelHead, TitleBar } from './app-chrome';

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
      <div role="tablist" aria-label="Kloyya screens" className="border-border mb-7 flex flex-wrap border-b">
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
                'text-caption -mb-px border-b-2 px-4 py-2.5 font-mono tracking-widest uppercase transition-colors first:pl-0',
                selected
                  ? 'border-intelligence-blue text-link'
                  : 'text-subtle hover:text-foreground border-transparent',
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

      <p className="text-caption text-subtle mt-3 font-mono">{caption}</p>
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
    <div className="border-border/60 border-r px-4 py-3 last:border-r-0">
      <div className="text-caption text-subtle font-mono tracking-widest uppercase">{label}</div>
      <div className="text-heading-s text-foreground mt-1 font-semibold tabular-nums">{value}</div>
      <div className={cn('text-caption font-mono', hot ? 'text-caution' : 'text-subtle')}>{note}</div>
    </div>
  );
}

/** Exported so the hero can use it as the backdrop behind the header — see Hero() in landing-page.tsx. */
export function HomeScreen() {
  return (
    <AppWindow>
      <TitleBar label="kloyya — home" status="Tue 26" />

      <div className="border-border grid grid-cols-2 border-b sm:grid-cols-4">
        <Kpi label="Events" value="5" note="2 need prep" />
        <Kpi label="Tasks due" value="8" note="3 high priority" hot />
        <Kpi label="Unread" value="213" note="4 need you" />
        <Kpi label="Focus left" value="4.5h" note="56% of day" />
      </div>

      <div className="px-4 py-4">
        <div className="border-border bg-background mb-3 flex items-center gap-3 rounded-sm border px-3 py-2.5">
          <span className="text-small text-subtle flex-1">Ask Kloyya anything about your work…</span>
          <span className="text-caption text-link border-link rounded-sm border px-2 py-0.5 font-mono">
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
    </AppWindow>
  );
}

function InboxScreen() {
  return (
    <AppWindow>
      <TitleBar label="kloyya — inbox" status="4 / 213" />
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
    </AppWindow>
  );
}

function CalendarScreen() {
  return (
    <AppWindow>
      <TitleBar label="kloyya — calendar" status="Tue 26 Jul" />
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
    </AppWindow>
  );
}

/** Re-exported so the hero can render a briefing without duplicating chrome. */
export function HeroBriefing(): ReactNode {
  return (
    <AppWindow>
      <TitleBar label="kloyya — this morning" status="07:42" />
      <div className="px-4 py-4">
        <PanelHead left="Your briefing" right="4 of 213 reviewed" />

        <BriefRow when="09:00" meta="3 threads · 1 doc revised yesterday 22:14">
          <Flag>Prep</Flag>
          Board sync — the Q3 forecast changed since you last read it
        </BriefRow>
        <BriefRow when="11:30" meta="waiting 2 days · review and send">
          <Flag>Draft ready</Flag>
          Amara is blocked on the vendor contract — reply written
        </BriefRow>
        <BriefRow when="14:00" meta="detected from calendar and project docs">
          <b className="font-semibold">Atlas milestone</b> slipped to Friday — nobody has told the
          customer
        </BriefRow>
        <BriefRow when="rest" meta="out of your view, still searchable" last>
          <Flag tone="handled">Quiet</Flag>
          209 messages need nothing from you today
        </BriefRow>
      </div>
    </AppWindow>
  );
}
