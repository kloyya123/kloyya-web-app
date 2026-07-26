'use client';

import { Lock, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { TitleBar } from './app-chrome';

/**
 * The product demo: one scripted Ask Kloyya session, playable in a browser, an
 * iPhone, or an Android handset.
 *
 * A recorded video would be heavier, would need hosting, and would go stale the
 * first time the UI changed. This is the same content rendered in the same
 * tokens as the app, so it cannot drift into showing a product we do not have.
 *
 * The script ends on a drafted reply held for approval, because that is the
 * single most important thing to be honest about: Kloyya writes, you send.
 */

type Device = 'web' | 'ios' | 'android';

/** When each line lands, in ms from pressing play. */
const CUES = [200, 1500, 3100, 5000, 6900, 8600, 10_200] as const;
const RUNTIME_SECONDS = 45;

export function DemoPlayer() {
  const [device, setDevice] = useState<Device>('web');
  const [revealed, setRevealed] = useState(0);
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);

  // Switching device restarts the demo: a half-played transcript suddenly
  // appearing on a phone reads as a glitch, not a feature.
  useEffect(() => {
    clearTimers();
    setStarted(false);
    setRevealed(0);
    setElapsed(0);
  }, [device, clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  function play() {
    clearTimers();
    setStarted(true);

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      setRevealed(CUES.length);
      setElapsed(RUNTIME_SECONDS);
      return;
    }

    setRevealed(0);
    CUES.forEach((cue, index) => {
      timers.current.push(setTimeout(() => setRevealed(index + 1), cue));
    });

    for (let second = 1; second <= RUNTIME_SECONDS; second += 1) {
      timers.current.push(setTimeout(() => setElapsed(second), second * 240));
    }
  }

  const clock = `00:${String(elapsed).padStart(2, '0')}`;
  const transcript = <Transcript revealed={revealed} />;

  return (
    <div>
      <DeviceSwitch value={device} onChange={setDevice} />

      <div className="relative flex justify-center">
        {device === 'web' ? (
          <WebFrame clock={clock}>{transcript}</WebFrame>
        ) : (
          <PhoneFrame os={device} clock={clock}>
            {transcript}
          </PhoneFrame>
        )}

        {started ? null : (
          <button
            type="button"
            onClick={play}
            className="bg-background/80 absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-sm transition-colors"
          >
            <span className="border-link text-link bg-background flex size-16 items-center justify-center rounded-full border transition-transform duration-200 group-hover:scale-105">
              <Play aria-hidden="true" className="ml-0.5 size-6 fill-current" />
            </span>
            <span className="text-caption text-muted-foreground font-mono tracking-widest uppercase">
              Play demo · 0:45
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function DeviceSwitch({
  value,
  onChange,
}: {
  value: Device;
  onChange: (device: Device) => void;
}) {
  const options: { id: Device; label: string }[] = [
    { id: 'web', label: 'Web' },
    { id: 'ios', label: 'iPhone' },
    { id: 'android', label: 'Android' },
  ];

  return (
    <div
      role="group"
      aria-label="Choose a device"
      className="border-border bg-surface shadow-level-1 mb-8 inline-flex overflow-hidden rounded-sm border"
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={cn(
              'text-caption border-border border-r px-4 py-2 font-mono tracking-widest uppercase transition-colors last:border-r-0',
              active
                ? 'bg-intelligence-blue text-on-intelligence-blue'
                : 'text-subtle hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function WebFrame({ clock, children }: { clock: string; children: ReactNode }) {
  return (
    <div className="bg-card border-border shadow-level-3 w-full max-w-2xl overflow-hidden rounded-md border">
      <div className="bg-surface border-border flex items-center gap-1.5 border-b px-3 py-2">
        <span aria-hidden="true" className="bg-border size-2.5 rounded-full" />
        <span aria-hidden="true" className="bg-border size-2.5 rounded-full" />
        <span aria-hidden="true" className="bg-border size-2.5 rounded-full" />
        <span className="bg-background border-border text-caption text-subtle ml-2 flex min-w-0 flex-1 items-center gap-1.5 rounded-full border px-3 py-0.5 font-mono">
          <Lock aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">app.kloyya.com/ask</span>
        </span>
      </div>
      <TitleBar label="kloyya — ask" status={clock} />
      <div className="min-h-96 px-4 py-4">{children}</div>
    </div>
  );
}

/**
 * A hardware mockup. The bezel stays dark in both themes because a phone is a
 * dark object regardless of what is on its screen; only the screen follows the
 * viewer's theme.
 */
function PhoneFrame({
  os,
  clock,
  children,
}: {
  os: 'ios' | 'android';
  clock: string;
  children: ReactNode;
}) {
  const ios = os === 'ios';

  return (
    <div
      className={cn(
        'shrink-0 bg-[#0b1020] shadow-[0_22px_50px_-26px_rgb(0_0_0/0.6)] ring-1 ring-white/10',
        ios ? 'w-[336px] rounded-[46px] p-3' : 'w-[336px] rounded-[30px] p-2.5',
      )}
    >
      <div
        className={cn(
          'bg-background relative flex h-[620px] flex-col overflow-hidden',
          ios ? 'rounded-[36px]' : 'rounded-[22px]',
        )}
      >
        {ios ? (
          <span
            aria-hidden="true"
            className="absolute top-2 left-1/2 z-30 h-6 w-22 -translate-x-1/2 rounded-full bg-[#0b1020]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute top-3 left-1/2 z-30 size-2.5 -translate-x-1/2 rounded-full bg-[#0b1020]"
          />
        )}

        <StatusBar android={!ios} />
        <TitleBar label="kloyya — ask" status={clock} />

        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>

        {ios ? (
          <div className="flex justify-center py-2">
            <span aria-hidden="true" className="bg-subtle h-1 w-28 rounded-full opacity-60" />
          </div>
        ) : (
          <div className="text-subtle flex justify-around px-12 py-2.5" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
              <path d="M9.5 1L3 7l6.5 6z" />
            </svg>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5.6" />
            </svg>
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1.4" y="1.4" width="11.2" height="11.2" rx="1.4" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBar({ android }: { android: boolean }) {
  const signal = (
    <svg width="15" height="10" viewBox="0 0 18 12" fill="currentColor" aria-hidden="true">
      <rect x="0" y="8" width="3" height="4" rx=".6" />
      <rect x="4.5" y="5.5" width="3" height="6.5" rx=".6" />
      <rect x="9" y="3" width="3" height="9" rx=".6" />
      <rect x="13.5" y="0" width="3" height="12" rx=".6" />
    </svg>
  );
  const wifi = (
    <svg width="13" height="10" viewBox="0 0 14 11" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d="M1 3.6a8.5 8.5 0 0112 0" />
      <path d="M3.4 6.2a5 5 0 017.2 0" />
      <circle cx="7" cy="9.2" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
  const battery = (
    <svg width="20" height="10" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
      <rect x=".6" y=".6" width="19" height="10.8" rx="2.6" />
      <rect x="2.4" y="2.4" width="13" height="7.2" rx="1.4" fill="currentColor" stroke="none" />
      <path d="M21.4 4.2v3.6" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );

  return (
    <div className="text-foreground text-caption flex items-center justify-between px-5 pt-3 pb-1 font-mono tabular-nums">
      <span>9:41</span>
      <span className="flex items-center gap-1.5">
        {android ? (
          <>
            {wifi}
            {signal}
          </>
        ) : (
          <>
            {signal}
            {wifi}
          </>
        )}
        {battery}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Turn({
  who,
  ai,
  shown,
  children,
}: {
  who: string;
  ai?: boolean;
  shown: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'border-border/60 flex items-start gap-2.5 border-b py-3 transition-all duration-500 last:border-b-0',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
      )}
    >
      <span
        className={cn(
          'text-caption w-14 shrink-0 pt-0.5 font-mono tracking-widest uppercase',
          ai ? 'text-ai' : 'text-subtle',
        )}
      >
        {who}
      </span>
      <span className="text-small text-foreground min-w-0 leading-relaxed">{children}</span>
    </div>
  );
}

function Cite({ children }: { children: ReactNode }) {
  return <span className="text-caption text-subtle mt-1.5 block font-mono">{children}</span>;
}

function Transcript({ revealed }: { revealed: number }) {
  return (
    <div>
      <Turn who="You" shown={revealed > 0}>
        What do I need to know before the board sync?
      </Turn>

      <Turn who="Kloyya" ai shown={revealed > 1}>
        Three things changed since the deck went out.
        <Cite>reading 41 messages · 6 documents · 3 events</Cite>
      </Turn>

      <Turn who="Kloyya" ai shown={revealed > 2}>
        <b className="font-semibold">1.</b> Finance revised Q3 revenue down 4% at 22:14 last
        night. Slide 7 still shows the old figure.
        <Cite>Q3 Forecast v9 · Drive · edited by Priya</Cite>
      </Turn>

      <Turn who="Kloyya" ai shown={revealed > 3}>
        <b className="font-semibold">2.</b> Atlas shipped two days early and is not in the deck.
        It is your only green milestone this quarter.
        <Cite>Atlas launch thread · Gmail · 14 replies</Cite>
      </Turn>

      <Turn who="Kloyya" ai shown={revealed > 4}>
        <b className="font-semibold">3.</b> Dana asked about hiring pace on Friday and has not
        had an answer. She is on the invite.
        <Cite>unanswered 4 days · flagged for you</Cite>
      </Turn>

      <Turn who="You" shown={revealed > 5}>
        Reply to Dana for me.
      </Turn>

      <Turn who="Kloyya" ai shown={revealed > 6}>
        Written in your voice, from the hiring plan and last week’s numbers.
        <span className="border-executive-purple text-muted-foreground bg-executive-purple/10 text-small mt-2 block rounded-sm border-l-2 px-3 py-2 leading-relaxed">
          Hi Dana — we are at 6 of 9 open roles filled, with two offers out this week.
          Engineering is the bottleneck, so I have moved the backend req to the top. Happy to
          walk through it in the sync if useful.
        </span>
        <span className="border-caution bg-warning/10 mt-2 block rounded-sm border border-dashed px-3 py-2.5">
          <span className="text-caption text-caution mb-2 block font-mono tracking-wider uppercase">
            Needs your approval to send
          </span>
          <span className="flex flex-wrap gap-1.5">
            <span className="text-caption bg-intelligence-blue text-on-intelligence-blue rounded-sm px-2.5 py-1 font-mono tracking-wider uppercase">
              Send
            </span>
            <span className="text-caption border-border text-muted-foreground bg-background rounded-sm border px-2.5 py-1 font-mono tracking-wider uppercase">
              Edit
            </span>
            <span className="text-caption border-border text-muted-foreground bg-background rounded-sm border px-2.5 py-1 font-mono tracking-wider uppercase">
              Discard
            </span>
          </span>
        </span>
        <Cite>Kloyya never sends anything you have not approved.</Cite>
      </Turn>
    </div>
  );
}
