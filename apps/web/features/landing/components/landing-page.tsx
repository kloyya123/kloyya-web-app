import { ArrowRight, Bell, Brain, Clock, Search, Share2, ShieldCheck, Split, Zap } from 'lucide-react';
import Link from 'next/link';
import { Logo, LogoMark } from '@/components/brand/logo';
import { NAV_ITEMS } from '@/components/layout/nav-items';
import { Button } from '@/components/ui';
import { integrationIcon } from '@/features/connections/integration-meta';
import { cn } from '@/lib/cn';
import { CONTACT_EMAIL, TOOLS } from '../content';
import { AskShowcaseCard } from './ask-showcase';
import { BRAND_ICONS } from './brand-icons';
import { ConnectHub } from './connect-hub';
import { Reveal } from './reveal';
import { SocialLinks } from './social-links';
import { WaitlistForm } from './waitlist-form';

/**
 * Kloyya's public front door — rebuilt to the founder's own reference screens:
 * a warm-white workspace app, a plain sans headline, and rounded outline
 * buttons rather than the earlier serif/cream editorial register.
 *
 * `/` renders for everyone, signed in or not — this is the company's front
 * door, and forwarding a returning visitor to their dashboard would hide it
 * from the person most likely to share the link.
 */
export function LandingPage() {
  return (
    <div className="light landing bg-[var(--landing-bg)] text-[color:var(--landing-ink)] min-h-dvh">
      <SiteHeader />

      <main id="main">
        <Hero />
        <ToolsStrip />
        <ProblemSolution />
        <FeatureTiles />
        <IntegrationHubSection />
        <HowItWorks />
        <AskShowcase />
        <ClosingCta />
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
            Trust Centre
          </Link>
          <Link href="/help" className="rounded-sm hover:text-[var(--landing-ink)]">
            Resources
          </Link>
        </nav>

        {/* Join Waitlist, not Get started, is the primary action here — the app
            is beta-gated to a handful of accounts, and everyone else lands on
            the waitlist regardless. Leading with a CTA the visitor can actually
            complete beats leading with one middleware will redirect away from.
            Log in stays reachable for the few who already have access. */}
        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/login"
            className="text-small whitespace-nowrap text-[var(--landing-ink-soft)] hover:text-[var(--landing-ink)]"
          >
            Sign in
          </Link>
          <Button asChild size="md" className="rounded-full">
            <a href="#waitlist">Join Waitlist</a>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem]"
        style={{
          background:
            'radial-gradient(60% 60% at 15% -10%, var(--landing-sky-2), transparent 65%), linear-gradient(to bottom, var(--landing-sky-1), var(--landing-bg) 85%)',
        }}
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-16 pb-24 md:grid-cols-2 md:pt-24 md:pb-32">
        <div>
          <span className="inline-flex items-center rounded-full bg-[var(--color-intelligence-blue)]/10 px-3 py-1 text-caption font-medium tracking-wide text-[var(--color-intelligence-blue)] uppercase">
            AI Chief of Staff
          </span>

          <h1 className="mt-6 text-[2.75rem] leading-[1.08] font-semibold tracking-tight text-[var(--landing-ink)] text-balance sm:text-6xl">
            The Intelligence Layer for Work.
          </h1>

          <p className="mt-6 max-w-md text-body leading-relaxed text-[var(--landing-ink-soft)]">
            Kloyya connects your tools, understands your work, and helps you make better
            decisions — faster.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-full px-7" trailingIcon={<ArrowRight aria-hidden="true" />}>
              <a href="#waitlist">Join the Waitlist</a>
            </Button>
          </div>
        </div>

        <Reveal delay={100}>
          <div className="relative mx-auto max-w-lg md:mx-0 md:ml-auto">
            <div
              aria-hidden="true"
              className="absolute -inset-8 -z-10 rounded-[2rem] bg-[var(--color-intelligence-blue)]/10 blur-3xl"
            />
            <div className="rotate-2 transition-transform duration-500 hover:rotate-0">
              <HeroDashboardMockup />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * The hero's dashboard mockup — a dark sidebar over a light workspace, per the
 * founder's reference screens. A deliberate departure from the rest of the
 * site's `.mockup` (light-sidebar) screens: decorative chrome on the marketing
 * page, not a claim about the product's own theme, which stays light-only
 * (see the app's `forcedTheme="light"`).
 */
function HeroDashboardMockup() {
  const sidebarItems = NAV_ITEMS.slice(0, 6);
  const connectedTools = TOOLS.slice(0, 3);

  return (
    <div className="mockup flex overflow-hidden rounded-2xl border border-[var(--mockup-border)] shadow-[var(--landing-shadow-lifted)]">
      <aside className="hidden w-40 shrink-0 flex-col bg-[#141221] px-3 py-4 sm:flex">
        <div className="mb-5 flex items-center gap-2 px-1">
          <LogoMark decorative className="size-5" />
          <span className="text-small font-semibold text-white">kloyya</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {sidebarItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <span
                key={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-sm px-2 py-1.5 text-caption',
                  index === 0 ? 'bg-white/10 font-medium text-white' : 'text-white/55',
                )}
              >
                <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[var(--mockup-bg)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-title font-semibold text-[var(--mockup-ink)]">Good morning</h2>
          <span className="flex size-8 items-center justify-center rounded-full border border-[var(--mockup-border)] bg-[var(--mockup-card)]">
            <Bell aria-hidden="true" className="size-3.5 text-[var(--mockup-ink-soft)]" />
          </span>
        </div>

        <div className="mb-5 flex items-center gap-2 rounded-full border border-[var(--mockup-border)] bg-[var(--mockup-card)] px-3.5 py-2">
          <Search aria-hidden="true" className="size-3.5 shrink-0 text-[var(--mockup-ink-soft)]" />
          <span className="text-caption text-[var(--mockup-ink-soft)]">Ask Kloyya anything…</span>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--mockup-border)] bg-[var(--mockup-card)] p-3">
            <p className="text-caption font-medium text-[var(--mockup-ink-soft)]">Priorities</p>
            <ul className="mt-2.5 space-y-2">
              {[
                { done: true, label: 'Reply to Jane' },
                { done: false, label: 'Review Q3 forecast' },
                { done: false, label: 'Prep 2pm client call' },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'size-3 shrink-0 rounded-full border',
                      item.done
                        ? 'border-[var(--mockup-positive)] bg-[var(--mockup-positive)]'
                        : 'border-[var(--mockup-border)]',
                    )}
                  />
                  <span className="truncate text-caption text-[var(--mockup-ink)]">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--mockup-border)] bg-[var(--mockup-card)] p-3">
            <p className="text-caption font-medium text-[var(--mockup-ink-soft)]">Focus</p>
            <p className="mt-2.5 text-title font-semibold text-[var(--mockup-ink)]">2h 15m</p>
            <p className="text-caption text-[var(--mockup-ink-soft)]">Deep work today</p>
          </div>

          <div className="col-span-2 rounded-xl border border-[var(--mockup-border)] bg-[var(--mockup-card)] p-3">
            <p className="mb-2.5 text-caption font-medium text-[var(--mockup-ink-soft)]">Connected tools</p>
            <div className="flex items-center gap-2">
              {connectedTools.map((tool) => {
                const Icon = BRAND_ICONS[tool.id] ?? integrationIcon(tool.id, tool.category);
                return (
                  <span
                    key={tool.id}
                    className="flex size-7 items-center justify-center rounded-full border border-[var(--mockup-border)] bg-[var(--mockup-bg)]"
                  >
                    <Icon aria-hidden="true" className="size-3.5" />
                  </span>
                );
              })}
              <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-[var(--mockup-border)] text-caption text-[var(--mockup-ink-soft)]">
                +
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The logo strip, honestly told: Linear's own version of this puts customer
 * logos here. Kloyya has none who have agreed to be named, so this shows the
 * true equivalent — real icons for real, live connectors — rather than
 * borrowed marks. Every entry is `TOOLS`, the same catalogue the connections
 * page reads.
 */
function ToolsStrip() {
  return (
    <div className="border-y border-[var(--landing-border)] bg-[var(--landing-bg-soft)]/60">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <p className="mb-5 text-center text-caption font-medium tracking-[0.2em] text-[var(--landing-ink-subtle)] uppercase">
          Tools you can connect
        </p>
        <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-x-10 gap-y-4 p-0">
          {TOOLS.map((tool) => {
            const Icon = BRAND_ICONS[tool.id] ?? integrationIcon(tool.id, tool.category);
            return (
              <li
                key={tool.name}
                className="flex items-center gap-2 font-medium whitespace-nowrap text-[var(--landing-ink-soft)]"
              >
                <Icon aria-hidden="true" className="size-5" />
                {tool.name}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

const PROBLEMS: { icon: typeof Split; title: string; body: string }[] = [
  {
    icon: Split,
    title: 'Scattered across tools',
    body: 'Mail, calendar and documents each hold half the picture. Nothing tells you what changed until you go looking.',
  },
  {
    icon: Clock,
    title: 'Mornings lost to catching up',
    body: 'Twenty minutes reading the same four apps before you can even decide what today actually needs from you.',
  },
];

const SOLUTIONS: { icon: typeof Brain; title: string; body: string }[] = [
  {
    icon: Brain,
    title: 'One place that reads all of it',
    body: 'Kloyya reads your mail, calendar and documents together, and cross-checks them against each other.',
  },
  {
    icon: Zap,
    title: 'A short list, already made',
    body: 'What moved, what’s waiting on you, what can wait — ready before you open anything.',
  },
];

/** The problem, then the solution — a plain before/after, no invented statistics. */
function ProblemSolution() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-card)] p-8">
            <p className="text-caption font-medium tracking-[0.2em] text-[var(--landing-ink-subtle)] uppercase">
              The problem
            </p>
            <div className="mt-6 flex flex-col gap-6">
              {PROBLEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--landing-bg-soft)]">
                      <Icon aria-hidden="true" className="size-4 text-[var(--landing-ink-soft)]" />
                    </span>
                    <div>
                      <p className="text-small font-medium text-[var(--landing-ink)]">{item.title}</p>
                      <p className="mt-1 text-caption leading-relaxed text-[var(--landing-ink-soft)]">{item.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>

        <Reveal delay={90}>
          <div className="h-full rounded-2xl border border-[var(--color-intelligence-blue)]/25 bg-[var(--color-intelligence-blue)]/5 p-8">
            <p className="text-caption font-medium tracking-[0.2em] text-[var(--color-intelligence-blue)] uppercase">
              Kloyya&rsquo;s solution
            </p>
            <div className="mt-6 flex flex-col gap-6">
              {SOLUTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--landing-card)] shadow-[var(--landing-shadow-card)]">
                      <Icon aria-hidden="true" className="size-4 text-[var(--color-intelligence-blue)]" />
                    </span>
                    <div>
                      <p className="text-small font-medium text-[var(--landing-ink)]">{item.title}</p>
                      <p className="mt-1 text-caption leading-relaxed text-[var(--landing-ink-soft)]">{item.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const FEATURE_TILES: { icon: typeof Share2; title: string; body: string; href: string }[] = [
  {
    icon: Share2,
    title: 'Connect your world',
    body: 'Bring the tools you already use into one place Kloyya can actually read.',
    href: '#tools',
  },
  {
    icon: Brain,
    title: 'Understand your work',
    body: 'Kloyya reads the signals across your mail, calendar and documents and surfaces what matters most.',
    href: '#how-it-works',
  },
  {
    icon: Zap,
    title: 'Act, faster',
    body: 'From your morning brief to a drafted reply, Kloyya moves the routine work along so you can decide on the rest.',
    href: '#how-it-works',
  },
  {
    icon: ShieldCheck,
    title: 'Trust every answer',
    body: 'Every answer shows the sources it came from — read access by default, nothing sent without you.',
    href: '/trust',
  },
];

/** Four tiles: what Kloyya actually does, each one true of the shipped product today. */
function FeatureTiles() {
  return (
    <section id="product" className="scroll-mt-20 mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <p className="text-caption font-medium tracking-[0.2em] text-[var(--color-intelligence-blue)] uppercase">
        Built for modern work
      </p>
      <div className="mt-3 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="max-w-lg text-heading-m font-semibold text-[var(--landing-ink)] text-balance">
          Everything you need. All in one intelligent workspace.
        </h2>
        <p className="max-w-sm text-small leading-relaxed text-[var(--landing-ink-soft)]">
          Kloyya brings your work, tools and knowledge together so you can focus on what truly
          matters.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURE_TILES.map((tile, index) => {
          const Icon = tile.icon;
          return (
            <Reveal key={tile.title} delay={index * 70}>
              <div>
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-[var(--color-intelligence-blue)]/10">
                  <Icon aria-hidden="true" className="size-5 text-[var(--color-intelligence-blue)]" />
                </span>
                <h3 className="mt-4 text-small font-semibold text-[var(--landing-ink)]">{tile.title}</h3>
                <p className="mt-1.5 text-caption leading-relaxed text-[var(--landing-ink-soft)]">{tile.body}</p>
                <a
                  href={tile.href}
                  className="mt-3 inline-flex items-center gap-1 text-caption font-medium text-[var(--color-intelligence-blue)] hover:underline"
                >
                  Learn more <ArrowRight aria-hidden="true" className="size-3" />
                </a>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

const HUB_OUTCOMES: { icon: typeof Brain; title: string; body: string }[] = [
  { icon: Brain, title: 'Understand', body: 'Kloyya reads and makes sense of your data.' },
  { icon: Share2, title: 'Connect', body: 'Brings context together across all your tools.' },
  { icon: Zap, title: 'Act', body: 'Surfaces the right insight at the right time.' },
];

/** Left: the claim. Right: the real diagram — tools flowing into one hub. */
function IntegrationHubSection() {
  const live = TOOLS.filter((tool) => tool.live);

  return (
    <section id="tools" className="scroll-mt-20 border-t border-[var(--landing-border)] bg-[var(--landing-bg-soft)]/40">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-16 sm:py-24 lg:grid-cols-2">
        <div>
          <p className="text-caption font-medium tracking-[0.2em] text-[var(--color-intelligence-blue)] uppercase">
            Integration system
          </p>
          <h2 className="mt-3 text-heading-m font-semibold text-[var(--landing-ink)] text-balance">
            All your tools. One intelligent system.
          </h2>
          <p className="mt-4 max-w-md text-body leading-relaxed text-[var(--landing-ink-soft)]">
            Kloyya connects the tools you use every day and turns scattered data into clear,
            actionable intelligence.
          </p>

          <div className="mt-8 flex flex-col gap-5">
            {HUB_OUTCOMES.map((outcome) => {
              const Icon = outcome.icon;
              return (
                <div key={outcome.title} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--landing-card)] shadow-[var(--landing-shadow-card)]">
                    <Icon aria-hidden="true" className="size-4 text-[var(--color-intelligence-blue)]" />
                  </span>
                  <div>
                    <p className="text-small font-medium text-[var(--landing-ink)]">{outcome.title}</p>
                    <p className="text-caption text-[var(--landing-ink-soft)]">{outcome.body}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-8 text-small text-[var(--landing-ink-subtle)]">
            {live.length} tools connectable today.{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--color-intelligence-blue)] underline underline-offset-4">
              Tell us what&rsquo;s missing.
            </a>
          </p>
        </div>

        <ConnectHub />
      </div>
    </section>
  );
}

const HOW_IT_WORKS_STEPS: { title: string; body: string }[] = [
  { title: 'Connect your tools', body: 'Securely connect the tools you already use to get started.' },
  { title: 'Kloyya understands', body: 'It reads, organizes and understands your work in context.' },
  { title: 'Intelligence in action', body: 'Kloyya surfaces the insights, priorities and answers that matter.' },
  { title: 'You decide, faster', body: 'Every answer comes with its sources — you make the call.' },
];

/** Four numbered steps, left to right — the actual pipeline, not a metaphor for it. */
function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <p className="text-caption font-medium tracking-[0.2em] text-[var(--color-intelligence-blue)] uppercase">
        How it works
      </p>
      <h2 className="mt-3 max-w-lg text-heading-m font-semibold text-[var(--landing-ink)] text-balance">
        From connected to understood, in four steps.
      </h2>

      <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {HOW_IT_WORKS_STEPS.map((step, index) => (
          <Reveal key={step.title} delay={index * 80}>
            <div className="relative">
              <span className="flex size-9 items-center justify-center rounded-full bg-[var(--color-intelligence-blue)] text-small font-semibold text-white">
                {index + 1}
              </span>
              {index < HOW_IT_WORKS_STEPS.length - 1 ? (
                <ArrowRight
                  aria-hidden="true"
                  className="absolute top-2.5 -right-6 hidden size-4 text-[var(--landing-border)] lg:block"
                />
              ) : null}
              <h3 className="mt-4 text-small font-semibold text-[var(--landing-ink)]">{step.title}</h3>
              <p className="mt-1.5 text-caption leading-relaxed text-[var(--landing-ink-soft)]">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/**
 * Ask Kloyya, shown doing its actual job: searches, then answers from
 * connected work and names its sources. See `AskShowcaseCard` for the
 * animated sequence itself.
 */
function AskShowcase() {
  return (
    <section className="border-t border-[var(--landing-border)] bg-[var(--landing-bg-soft)]/40">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="mx-auto mb-12 max-w-xl text-center">
          <p className="text-caption font-medium tracking-[0.2em] text-[var(--color-intelligence-blue)] uppercase">
            Ask Kloyya
          </p>
          <h2 className="mt-3 text-heading-m font-semibold text-[var(--landing-ink)] text-balance">
            Not a chatbot guessing — an answer with its sources attached.
          </h2>
        </div>

        <Reveal>
          <div className="mx-auto max-w-4xl rounded-2xl shadow-[var(--landing-shadow-lifted)]">
            <AskShowcaseCard />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Abstract translucent card silhouettes — CSS only, echoing the reference's stacked-cards motif. */
function CardSilhouettes() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute top-1/2 right-8 hidden -translate-y-1/2 sm:block">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute h-40 w-28 rounded-2xl border border-white/25 bg-white/10"
          style={{ right: i * 26, top: -80 + i * 6, transform: `rotate(${(i - 1) * 6}deg)` }}
        />
      ))}
    </div>
  );
}

/** The closing band: one more chance to join the waitlist. */
function ClosingCta() {
  return (
    <section
      id="waitlist"
      className="relative scroll-mt-24 overflow-hidden py-20 md:py-28"
      style={{
        background:
          'radial-gradient(60% 80% at 20% 0%, #4a86ff, transparent 60%), radial-gradient(70% 60% at 90% 100%, #2f6fe0, transparent 60%), linear-gradient(160deg, var(--color-intelligence-blue), #1d4fc4)',
      }}
    >
      <CardSilhouettes />
      <Reveal className="relative mx-auto max-w-lg px-6">
        <h2 className="text-3xl leading-tight font-semibold text-white text-balance sm:text-4xl">
          Be the first to experience Kloyya.
        </h2>
        <p className="mt-3 max-w-sm text-body text-white/85">
          Join the waitlist and get early access when we launch.
        </p>

        <div className="light mt-8 max-w-md rounded-2xl bg-[var(--landing-card)] p-6 shadow-[var(--landing-shadow-lifted)]">
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
        { label: 'How it works', href: '#how-it-works' },
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

