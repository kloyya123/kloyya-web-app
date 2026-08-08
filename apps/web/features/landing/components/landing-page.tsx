import { ArrowRight, Eye, KeyRound, Layers, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo, LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui';
import { integrationIcon } from '@/features/connections/integration-meta';
import { cn } from '@/lib/cn';
import { CONTACT_EMAIL, FAQS, FEATURES, ROLES, TOOLS } from '../content';
import { ConnectHub } from './connect-hub';
import { Reveal } from './reveal';
import { WaitlistForm } from './waitlist-form';
import {
  AskMotion,
  AskScreen,
  CalendarScreen,
  DocumentsScreen,
  InboxScreen,
  ProductScreens,
  ReplyScreen,
  TodayMotion,
} from './product-screens';
import { SocialLinks } from './social-links';

/**
 * Kloyya's public front door.
 *
 * Visual language is deliberately not KDS: a warm, editorial register for the
 * marketing page (serif display type, cream background, soft rounded cards),
 * kept out of the product entirely. See the `.landing` block in tokens.css for
 * why that is a scoped exception rather than a rule change.
 *
 * `/` renders for everyone, signed in or not — this is the company's front
 * door, and forwarding a returning visitor to their dashboard would hide the
 * pricing and FAQ from the person most likely to look them up, and turn a
 * shared kloyya.com link into someone else's dashboard.
 */
export function LandingPage() {
  return (
    /* Two classes doing two different jobs. `.light` sets the standard KDS
     * tokens (`bg-card`, `border-border`, `text-subtle`…) so every screenshot
     * mockup and the Button component keep rendering exactly as they do in the
     * product — a white "window" is part of the look, not a bug. `.landing`
     * layers the warm cream background and ink on top, for the hand-written
     * sections around those windows. Neither reaches into the product. */
    <div className="light landing bg-[var(--landing-bg)] text-[color:var(--landing-ink)] min-h-dvh">
      <SiteHeader />

      <main id="main">
        <Hero />
        <ToolStrip />
        <IntroBlock />
        <PillarBand />
        <PastelCardRow />

        <Section
          eyebrow="See it think"
          title={
            <>
              Search, then <Accent>answer.</Accent>
            </>
          }
          lede="Not a chatbot guessing — Kloyya reads your workspace first, and shows what it read."
          id="how-it-works"
        >
          <Lifted>
            <AskMotion />
          </Lifted>
        </Section>

        <Section
          eyebrow="See it work"
          title={
            <>
              Kloyya, in <Accent>action.</Accent>
            </>
          }
          lede="Three screens you'll live in. Nothing here is a placeholder."
          id="product"
        >
          <Lifted>
            <ProductScreens />
          </Lifted>
        </Section>

        <Section
          eyebrow="What it does"
          title={
            <>
              Five jobs, done <Accent>quietly.</Accent>
            </>
          }
          lede="Kloyya does not ask for a new workflow. It reads the one you have."
        >
          <div className="flex flex-col gap-20 sm:gap-28">
            {FEATURES.map((feature, index) => (
              <FeatureRow key={feature.title} index={index} {...feature} />
            ))}
          </div>
        </Section>

        <ShippedStrip />

        <Section
          eyebrow="Built for you"
          title={
            <>
              However you <Accent>work.</Accent>
            </>
          }
          lede="Too much arriving, too little of it yours."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((role, index) => (
              <Reveal key={role.name} delay={index * 70}>
                <div className="rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-card)] p-6 shadow-[var(--landing-shadow-card)]">
                  <span className="text-caption font-mono tracking-widest text-[var(--color-intelligence-blue)] uppercase">
                    {role.name}
                  </span>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--landing-ink-soft)]">
                    {role.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        <Section
          eyebrow="Connects"
          title={
            <>
              Bring your own <Accent>tools.</Accent>
            </>
          }
          lede="Read access by default. Anything that acts — sending, declining, replying — stays off until you switch it on, and is revocable in one click."
          id="tools"
        >
          <ConnectHub />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((tool) => (
              <div
                key={tool.name}
                className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-card)] p-5 shadow-[var(--landing-shadow-card)]"
              >
                <span className="text-body text-[var(--landing-ink)]">{tool.name}</span>
                <span
                  className={cn(
                    'text-caption inline-flex items-center gap-2 font-mono tracking-wider whitespace-nowrap uppercase',
                    tool.live ? 'text-[var(--color-success)]' : 'text-[var(--landing-ink-subtle)]',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-1.5 rounded-full',
                      tool.live ? 'bg-[var(--color-success)]' : 'bg-[var(--landing-ink-subtle)]',
                    )}
                  />
                  {tool.live ? 'Live' : 'Next'}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-5 text-small text-[var(--landing-ink-subtle)]">
            Missing something you rely on?{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--color-intelligence-blue)] underline underline-offset-4">
              Tell us and we will build it.
            </a>
          </p>
        </Section>

        <Section
          eyebrow="Safe with us"
          title={
            <>
              Private enough to use <Accent>real data.</Accent>
            </>
          }
          lede="Connecting a tool should feel safe. Kloyya reads on a least-privilege basis and stays out of your way until you ask it something."
        >
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <TrustIcon
              icon={ShieldCheck}
              title="Read-only, always"
              body="Kloyya can read what you connect. Sending, editing or deleting is a separate switch you turn on yourself."
            />
            <TrustIcon
              icon={KeyRound}
              title="Your login stays private"
              body="Connections go through the provider's own sign-in — Google, Microsoft, Notion. Kloyya never sees your password."
            />
            <TrustIcon
              icon={Lock}
              title="Encrypted, and yours"
              body="Every token is encrypted at rest. Disconnect a tool or delete your account and the access — and the data — goes with it."
            />
            <TrustIcon
              icon={Eye}
              title="Nothing hidden"
              body="Every answer shows the sources it came from — mail, calendar, or a document — so you can check it yourself."
            />
          </div>
        </Section>

        <Section
          eyebrow="Questions"
          title={
            <>
              Fair <Accent>questions.</Accent>
            </>
          }
          lede="Mostly about your data and what Kloyya is allowed to do, which is the right thing to ask about."
          id="faq"
        >
          <div className="max-w-3xl divide-y divide-[var(--landing-border)] rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-card)] shadow-[var(--landing-shadow-card)]">
            {FAQS.map((faq, index) => (
              <details key={faq.q} open={index === 0} className="group px-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-body text-[var(--landing-ink)] marker:content-none">
                  {faq.q}
                  <span
                    aria-hidden="true"
                    className="shrink-0 font-mono text-[var(--color-intelligence-blue)] transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-[60ch] pb-5 text-small leading-relaxed text-[var(--landing-ink-soft)]">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </Section>

        <FinalCta />
      </main>

      <SiteFooter />
    </div>
  );
}

/* ---------------------------------------------------------------- chrome */

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--landing-border)] bg-[var(--landing-bg)]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="rounded-sm" aria-label="Kloyya home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 text-small text-[var(--landing-ink-soft)] sm:flex">
          <a href="#product" className="rounded-sm hover:text-[var(--landing-ink)]">
            Product
          </a>
          <a href="#tools" className="rounded-sm hover:text-[var(--landing-ink)]">
            Integrations
          </a>
          <Link href="/trust" className="rounded-sm hover:text-[var(--landing-ink)]">
            Trust
          </Link>
        </nav>

        {/* Restored on request: Get Started leads straight to an account, and
            Log in is one click away for a returning visitor. The waitlist is
            not removed for it — it stays reachable from the hero and the
            final section below, as its own path for someone who would rather
            wait than sign up today.

            Log in is deliberately NOT hidden below `sm` the way the nav links
            above are: those are conveniences a mobile visitor can live
            without, but log in is the one thing a returning user on a phone
            has no other way to reach from this page. It was hidden here once
            already and cost exactly that — fixed, not a style call. */}
        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/login"
            className="text-small whitespace-nowrap text-[var(--landing-ink-soft)] hover:text-[var(--landing-ink)]"
          >
            Log in
          </Link>
          <Button
            asChild
            size="md"
            className="rounded-full"
            trailingIcon={<ArrowRight aria-hidden="true" className="size-4" />}
          >
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* The sky: a soft blue bloom fading to white, standing in for Aside's
          literal cloud photo with a gradient in Kloyya's own accent instead of
          a stock image. Two overlapping radial blooms read as depth rather
          than a flat wash. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem]"
        style={{
          background:
            'radial-gradient(70% 60% at 30% -10%, var(--landing-sky-2), transparent 65%), radial-gradient(60% 50% at 80% 0%, var(--landing-sky-3), transparent 60%), linear-gradient(to bottom, var(--landing-sky-1), var(--landing-bg) 85%)',
        }}
      />

      <div className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center md:pt-28 md:pb-20">
        <span className="text-caption font-mono tracking-[0.2em] text-[var(--landing-ink-subtle)] uppercase">
          AI Chief of Staff
        </span>

        <h1 className="mt-6 text-[2.5rem] leading-[1.1] font-semibold tracking-tight text-[var(--landing-ink)] text-balance sm:text-6xl lg:text-[4rem]">
          Ask your work, anything.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-body text-[var(--landing-ink-soft)]">
          Kloyya reads your mail, calendar and documents overnight, then hands you the short list
          each morning — what moved, what’s waiting on you, what can wait. Ask anything and get an
          answer with its sources attached.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="rounded-full px-8"
            trailingIcon={<ArrowRight aria-hidden="true" />}
          >
            <Link href="/signup">Get started</Link>
          </Button>
          <a
            href="#waitlist"
            className="text-small text-[var(--landing-ink-soft)] underline underline-offset-4 hover:text-[var(--landing-ink)]"
          >
            or join the waitlist
          </a>
        </div>

        <p className="mt-4 text-caption font-mono text-[var(--landing-ink-subtle)]">
          30 days free. No card required.
        </p>

        <Reveal delay={120} className="mx-auto mt-16 max-w-3xl">
          <Lifted>
            <TodayMotion />
          </Lifted>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * The strip under the hero: the tools Kloyya connects to.
 *
 * The reference design puts customer logos here. Kloyya has no customers who
 * have agreed to be named, and borrowed logos are the fastest possible way to
 * lose the trust this whole product is selling — so this says the true version
 * of the same thing instead. Every name here is a connector that exists.
 */
/**
 * The logo strip, Kloyya's way — Linear puts customer logos here; Kloyya has
 * none who have agreed to be named, so this says the true version of the same
 * thing: real icons for real, live connectors, from the exact lookup the
 * connections page itself uses. Not text names — an icon row, the way Linear's
 * own strip reads at a glance.
 */
function ToolStrip() {
  const live = TOOLS.filter((tool) => tool.live);
  return (
    <div className="border-y border-[var(--landing-border)] bg-[var(--landing-bg-soft)]/60">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <p className="mb-5 text-center text-caption font-mono tracking-[0.2em] text-[var(--landing-ink-subtle)] uppercase">
          Works with what you already use
        </p>
        <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-x-10 gap-y-4 p-0">
          {live.map((tool) => {
            const Icon = integrationIcon(tool.id, tool.category);
            return (
              <li
                key={tool.name}
                className="flex items-center gap-2 font-medium whitespace-nowrap text-[var(--landing-ink-soft)]"
              >
                <Icon aria-hidden="true" className="size-5 text-[var(--landing-ink)]" />
                {tool.name}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Aside's "Introducing X" two-column beat — a bold claim, then the reasoning behind it. */
function IntroBlock() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <p className="mb-6 text-caption font-mono tracking-[0.2em] text-[var(--color-intelligence-blue)] uppercase">
        Introducing Kloyya
      </p>
      <div className="grid gap-8 sm:grid-cols-2">
        <h2 className="text-heading-m font-semibold text-[var(--landing-ink)]">
          Your day arrives as noise. Kloyya reads it before you do.
        </h2>
        <p className="text-body leading-relaxed text-[var(--landing-ink-soft)]">
          Most mornings start by reading the same four tools in a row, guessing which thread
          actually needs you. Kloyya reads them overnight instead, cross-checks what changed
          against what you already know, and hands you a short list — not a longer inbox.
        </p>
      </div>
    </section>
  );
}

const PASTEL_CARDS: { gradient: string; title: string; body: string; snippet: string }[] = [
  {
    gradient: 'from-[#ffdaed] to-[#ffb9dc]',
    title: 'Signing in',
    body: 'Kloyya connects through each provider’s own sign-in — Google, Microsoft, Notion. Never your password.',
    snippet: 'Connected: Gmail, Calendar, Drive',
  },
  {
    gradient: 'from-[#d8f6e0] to-[#b8ecc9]',
    title: 'Every morning',
    body: 'A ranked list waiting before you open anything — what moved, what’s owed, what can wait.',
    snippet: '3 things need you today',
  },
  {
    gradient: 'from-[#dce9ff] to-[#bcd6ff]',
    title: 'Ask anything',
    body: 'Plain-language questions, answered from your own connected work — sources attached.',
    snippet: 'Who is blocked on the vendor contract?',
  },
];

/** Aside's pastel-gradient card row — real snippets of Kloyya's own copy, not stock UI. */
function PastelCardRow() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <div className="grid gap-5 sm:grid-cols-3">
        {PASTEL_CARDS.map((card, index) => (
          <Reveal key={card.title} delay={index * 90}>
            <div className="flex h-full flex-col">
              <div className={cn('flex h-40 items-end rounded-2xl bg-gradient-to-br p-4', card.gradient)}>
                <span className="rounded-full bg-white/90 px-3 py-1.5 text-caption font-medium text-[var(--landing-ink)] shadow-sm">
                  {card.snippet}
                </span>
              </div>
              <h3 className="mt-4 text-small font-semibold text-[var(--landing-ink)]">{card.title}</h3>
              <p className="mt-1 text-caption leading-relaxed text-[var(--landing-ink-soft)]">{card.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const PILLARS: { icon: typeof Layers; title: string; body: string }[] = [
  {
    icon: Layers,
    title: 'Reads everything',
    body: 'Connects to what you already use — mail, calendar, documents — nothing new to learn.',
  },
  {
    icon: Sparkles,
    title: 'Understands context',
    body: 'Cross-checks a thread against the calendar and the doc it references, not just one at a time.',
  },
  {
    icon: ShieldCheck,
    title: 'Acts only when told to',
    body: 'Read access by default. Sending, replying or declining is a separate switch you turn on.',
  },
];

/** Linear's "A new species of product tool" band, in Kloyya's own words. */
function PillarBand() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <div className="grid gap-10 sm:grid-cols-3">
        {PILLARS.map((pillar, index) => {
          const Icon = pillar.icon;
          return (
            <Reveal key={pillar.title} delay={index * 90}>
              <div className="text-center sm:text-left">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--color-intelligence-blue)]/10">
                  <Icon aria-hidden="true" className="size-5 text-[var(--color-intelligence-blue)]" />
                </span>
                <h3 className="mt-4 text-title font-semibold text-[var(--landing-ink)]">{pillar.title}</h3>
                <p className="mt-2 text-small leading-relaxed text-[var(--landing-ink-soft)]">{pillar.body}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

const SHIPPED: { date: string; title: string; body: string }[] = [
  { date: 'This week', title: 'Slack, live', body: 'Messages sync as they arrive, not just once a day.' },
  { date: 'This week', title: 'Plans for how you actually work', body: 'Pro, Student, Founder and Business — pick the one that fits.' },
  { date: 'This week', title: 'Trust Centre, Compliance and Help', body: 'What Kloyya can see, how it handles data, and how to reach us — all public now.' },
];

/** Linear's changelog rhythm — small, dated, and only things actually shipped. */
function ShippedStrip() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <p className="mb-6 text-caption font-mono tracking-[0.2em] text-[var(--landing-ink-subtle)] uppercase">
        Recently shipped
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {SHIPPED.map((item, index) => (
          <Reveal key={item.title} delay={index * 70}>
            <div className="h-full rounded-xl border border-[var(--landing-border)] bg-[var(--landing-card)] p-5">
              <span className="text-caption font-mono text-[var(--landing-ink-subtle)]">{item.date}</span>
              <h3 className="mt-1.5 text-small font-semibold text-[var(--landing-ink)]">{item.title}</h3>
              <p className="mt-1.5 text-caption leading-relaxed text-[var(--landing-ink-soft)]">{item.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/** Lifts a screenshot mockup off the page with a stronger shadow than the KDS default. */
/**
 * The soft ambient glow behind a screenshot — the Linear-hero trick of a
 * blurred color bloom under the window, rather than the window sitting flat
 * on the page. In Kloyya's own theme: Intelligence Blue, low opacity, not
 * Linear's own gradient.
 */
function Lifted({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 rounded-[2rem] bg-[var(--color-intelligence-blue)]/10 blur-3xl"
      />
      <div className="rounded-2xl shadow-[var(--landing-shadow-lifted)]" style={{ borderRadius: '1rem' }}>
        <MacbookFrame>{children}</MacbookFrame>
      </div>
    </div>
  );
}

/**
 * A screen shown the way it's actually seen — on a laptop, not floating free.
 * CSS only: no device-mockup asset to keep in sync with the real window chrome.
 */
function MacbookFrame({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="relative rounded-t-xl bg-[#1d1d1f] p-2 pb-0">
        <div
          aria-hidden="true"
          className="absolute top-1.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[#0a0a0a]"
        />
        <div className="overflow-hidden rounded-t-md">{children}</div>
      </div>
      <div
        aria-hidden="true"
        className="relative h-2.5 rounded-b-xl bg-gradient-to-b from-[#dcdcde] to-[#b7b7ba]"
      >
        <span className="absolute top-0 left-1/2 h-1 w-16 -translate-x-1/2 rounded-b-md bg-[#a5a5a8]" />
      </div>
    </div>
  );
}

/** The italic serif emphasis word — the one technique borrowed directly from the reference. */
function Accent({ children }: { children: ReactNode }) {
  return <em className="font-serif text-[var(--color-intelligence-blue)] not-italic italic">{children}</em>;
}

/** A centered section: eyebrow label, serif headline with one accented word, lede, content. */
function Section({
  eyebrow,
  title,
  lede,
  id,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lede: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-[var(--landing-border)] py-16 md:py-24">
      <Reveal className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="text-caption font-mono tracking-[0.2em] text-[var(--landing-ink-subtle)] uppercase">
            {eyebrow}
          </span>
          <h2 className="mt-3 font-serif text-3xl leading-tight font-normal text-[var(--landing-ink)] text-balance sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 text-body text-[var(--landing-ink-soft)]">{lede}</p>
        </div>
        {children}
      </Reveal>
    </section>
  );
}

/** Each feature's real mockup, in FEATURES order — see product-screens.tsx. */
const FEATURE_SCREENS = [InboxScreen, ReplyScreen, CalendarScreen, DocumentsScreen, AskScreen];

/**
 * Linear's alternating rhythm: text on one side, the real screen it describes
 * on the other, flipping every row — not a card grid where every claim looks
 * like every other claim, but each one paired with the screen that proves it.
 */
function FeatureRow({ title, body, index }: { title: string; body: string; index: number }) {
  const Screen = FEATURE_SCREENS[index] ?? FEATURE_SCREENS[0]!;
  const reversed = index % 2 === 1;

  return (
    <Reveal>
      <div className={cn('flex flex-col items-center gap-10 lg:flex-row lg:gap-16', reversed && 'lg:flex-row-reverse')}>
        <div className="w-full max-w-md text-center lg:w-1/2 lg:max-w-none lg:text-left">
          <span className="font-mono text-caption tracking-widest text-[var(--color-intelligence-blue)] uppercase">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className="mt-2 text-heading-s font-semibold text-[var(--landing-ink)]">{title}</h3>
          <p className="mt-3 text-body leading-relaxed text-[var(--landing-ink-soft)]">{body}</p>
        </div>
        <div className="w-full lg:w-1/2">
          <Lifted>
            <Screen />
          </Lifted>
        </div>
      </div>
    </Reveal>
  );
}

/** Aside's icon-grid privacy row — no card border, just an icon and two lines. */
function TrustIcon({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}) {
  return (
    <div className="text-center sm:text-left">
      <span className="inline-flex size-9 items-center justify-center rounded-full bg-[var(--landing-bg-soft)]">
        <Icon aria-hidden="true" className="size-4 text-[var(--landing-ink)]" />
      </span>
      <h3 className="mt-3 text-small font-semibold text-[var(--landing-ink)]">{title}</h3>
      <p className="mt-1.5 text-caption leading-relaxed text-[var(--landing-ink-soft)]">{body}</p>
    </div>
  );
}

/**
 * The closing band. Get Started is the primary action; the waitlist is kept —
 * on request — as the path for someone who would rather be notified than open
 * an account today.
 */
/** Aside's dramatic closing band, in Kloyya's own accent instead of theirs. */
function FinalCta() {
  return (
    <section
      className="relative overflow-hidden py-20 md:py-28"
      style={{
        background:
          'radial-gradient(60% 80% at 20% 0%, #4a86ff, transparent 60%), radial-gradient(70% 60% at 90% 100%, #2f6fe0, transparent 60%), linear-gradient(160deg, var(--color-intelligence-blue), #1d4fc4)',
      }}
    >
      <Reveal className="relative mx-auto max-w-2xl px-6 text-center">
        <h2 className="text-3xl leading-tight font-semibold text-white text-balance sm:text-4xl">
          Tomorrow morning, the list is already made.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-body text-white/85">
          Create an account and connect one tool. Kloyya starts reading straight away.
        </p>

        <div className="mt-8 flex justify-center">
          <Button
            asChild
            size="lg"
            className="rounded-full bg-white px-8 text-[var(--color-intelligence-blue)] hover:bg-white/90"
            trailingIcon={<ArrowRight aria-hidden="true" />}
          >
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
        <p className="mt-3 text-caption font-mono text-white/70">30 days free, no card required.</p>

        <div
          id="waitlist"
          className="light mx-auto mt-12 max-w-md scroll-mt-24 rounded-2xl bg-[var(--landing-card)] p-6 text-left shadow-[var(--landing-shadow-lifted)]"
        >
          <h3 className="text-title font-semibold text-[var(--landing-ink)]">Not ready for an account?</h3>
          <p className="mt-1.5 mb-4 text-small text-[var(--landing-ink-soft)]">
            Leave your address and we will email you when something worth knowing ships — new
            integrations, or the mobile apps. Nothing else.
          </p>
          <WaitlistForm source="landing-final" />
        </div>
      </Reveal>
    </section>
  );
}

export function SiteFooter() {
  const columns: { heading: string; links: { label: string; href: string }[] }[] = [
    {
      heading: 'Product',
      links: [
        { label: 'Overview', href: '#product' },
        { label: 'Integrations', href: '#tools' },
      ],
    },
    {
      heading: 'Company',
      links: [{ label: 'Contact', href: '/contact' }],
    },
    {
      heading: 'Resources',
      links: [
        { label: 'Help', href: '/help' },
        { label: 'FAQ', href: '#faq' },
        { label: 'Trust Centre', href: '/trust-center' },
      ],
    },
    {
      heading: 'Legal',
      links: [
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
        { label: 'Compliance', href: '/compliance' },
      ],
    },
  ];

  return (
    <footer className="border-t border-[var(--landing-border)] bg-[var(--landing-bg-soft)]/60">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-8 py-12 sm:grid-cols-3 lg:grid-cols-5">
          {columns.map((column) => (
            <div key={column.heading}>
              <h2 className="mb-3 text-caption font-mono font-medium tracking-widest text-[var(--landing-ink-subtle)] uppercase">
                {column.heading}
              </h2>
              {column.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="block rounded-sm py-1 text-small text-[var(--landing-ink-soft)] hover:text-[var(--color-intelligence-blue)]"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}

          <div>
            <h2 className="mb-3 text-caption font-mono font-medium tracking-widest text-[var(--landing-ink-subtle)] uppercase">
              Follow
            </h2>
            <SocialLinks />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--landing-border)] py-5 text-caption font-mono text-[var(--landing-ink-subtle)]">
          <span className="flex items-center gap-2.5">
            <LogoMark decorative className="size-5" />© 2026 Kloyya Inc. All rights reserved.
          </span>
          <span>Built for people with too much arriving.</span>
        </div>
      </div>
    </footer>
  );
}
