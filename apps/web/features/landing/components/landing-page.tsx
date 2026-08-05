import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo, LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CONTACT_EMAIL, FAQS, FEATURES, PLANS, PRICING_FOOTNOTE, ROLES, TOOLS, TRIAL_NOTE, type Plan } from '../content';
import { ConnectHub } from './connect-hub';
import { Reveal } from './reveal';
import { WaitlistForm } from './waitlist-form';
import { HeroBriefing, ProductScreens } from './product-screens';
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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <FeatureCard key={feature.title} index={index} {...feature} />
            ))}
          </div>
        </Section>

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
            {ROLES.map((role) => (
              <div
                key={role.name}
                className="rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-card)] p-6 shadow-[var(--landing-shadow-card)]"
              >
                <span className="text-caption font-mono tracking-widest text-[var(--color-intelligence-blue)] uppercase">
                  {role.name}
                </span>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--landing-ink-soft)]">
                  {role.body}
                </p>
              </div>
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
              Always <Accent>private.</Accent>
            </>
          }
          lede="Connecting a tool should feel safe. Kloyya reads on a least-privilege basis and stays out of your way until you ask it something."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <TrustCard
              title="Read-only, always"
              body="Kloyya can read what you connect. Sending, editing or deleting is a separate switch you turn on yourself."
            />
            <TrustCard
              title="Your login stays private"
              body="Connections go through the provider's own sign-in — Google, Microsoft, Notion. Kloyya never sees your password."
            />
            <TrustCard
              title="Encrypted, and yours"
              body="Every token is encrypted at rest. Disconnect a tool or delete your account and the access — and the data — goes with it."
            />
          </div>
        </Section>

        <Section
          eyebrow="Pricing"
          title={
            <>
              One plan. That’s the whole <Accent>menu.</Accent>
            </>
          }
          lede={TRIAL_NOTE}
          id="pricing"
        >
          <div className="mx-auto grid max-w-sm gap-5">
            {PLANS.map((plan) => (
              <PricingCard key={plan.name} plan={plan} />
            ))}
          </div>
          <p className="mt-5 text-small text-[var(--landing-ink-subtle)]">{PRICING_FOOTNOTE}</p>
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
          <a href="#pricing" className="rounded-sm hover:text-[var(--landing-ink)]">
            Pricing
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
      {/* A quiet vignette in the same warm neutrals — depth without the
          product's blue/purple gradient, which has no place on this page
          anymore (see tokens.css: the marketing page is not KDS). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, var(--landing-bg-soft), transparent 70%)',
        }}
      />

      <div className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center md:pt-28 md:pb-24">
        <span className="text-caption font-mono tracking-[0.2em] text-[var(--landing-ink-subtle)] uppercase">
          AI Chief of Staff
        </span>

        <h1 className="mt-6 font-serif text-[2.75rem] leading-[1.08] font-normal tracking-tight text-[var(--landing-ink)] text-balance sm:text-6xl lg:text-[4.25rem]">
          Ask your work, <Accent>anything.</Accent>
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
          Free to start. No card required. The free plan does not expire.
        </p>

        <Reveal delay={120} className="mx-auto mt-16 max-w-3xl">
          <Lifted>
            <HeroBriefing />
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
function ToolStrip() {
  const live = TOOLS.filter((tool) => tool.live);
  return (
    <div className="border-y border-[var(--landing-border)] bg-[var(--landing-bg-soft)]/60">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <p className="mb-4 text-center text-caption font-mono tracking-[0.2em] text-[var(--landing-ink-subtle)] uppercase">
          Works with what you already use
        </p>
        <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-x-10 gap-y-3 p-0">
          {live.map((tool) => (
            <li key={tool.name} className="font-medium whitespace-nowrap text-[var(--landing-ink-soft)]">
              {tool.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Lifts a screenshot mockup off the page with a stronger shadow than the KDS default. */
function Lifted({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl shadow-[var(--landing-shadow-lifted)]" style={{ borderRadius: '1rem' }}>
      {children}
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

function FeatureCard({ title, body, index }: { title: string; body: string; index: number }) {
  return (
    <article
      className={cn(
        'flex flex-col gap-2 rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-card)] p-6 shadow-[var(--landing-shadow-card)]',
        index === 0 && 'sm:col-span-2 lg:col-span-1',
      )}
    >
      <span className="font-mono text-caption tracking-widest text-[var(--color-intelligence-blue)] uppercase">
        {String(index + 1).padStart(2, '0')}
      </span>
      <h3 className="text-title font-semibold text-[var(--landing-ink)]">{title}</h3>
      <p className="m-0 text-[15px] leading-relaxed text-[var(--landing-ink-soft)]">{body}</p>
    </article>
  );
}

function TrustCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-card)] p-6 text-center shadow-[var(--landing-shadow-card)]">
      <h3 className="text-title font-semibold text-[var(--landing-ink)]">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--landing-ink-soft)]">{body}</p>
    </div>
  );
}

function PricingCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-5 rounded-2xl border p-7',
        plan.featured
          ? 'border-[var(--color-intelligence-blue)]/40 bg-[var(--landing-card)] shadow-[var(--landing-shadow-lifted)]'
          : 'border-[var(--landing-border)] bg-[var(--landing-card)] shadow-[var(--landing-shadow-card)]',
      )}
    >
      <span
        className={cn(
          'text-caption font-mono tracking-widest uppercase',
          plan.featured ? 'text-[var(--color-intelligence-blue)]' : 'text-[var(--landing-ink-subtle)]',
        )}
      >
        {plan.name}
      </span>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between rounded-xl border border-[var(--landing-border)] px-4 py-3">
          <span className="text-caption font-mono tracking-widest text-[var(--landing-ink-subtle)] uppercase">
            Monthly
          </span>
          <span className="text-title font-semibold text-[var(--landing-ink)]">
            {plan.price}
            {plan.period ? (
              <span className="text-caption font-mono text-[var(--landing-ink-subtle)]">{plan.period}</span>
            ) : null}
          </span>
        </div>

        {plan.yearlyPrice ? (
          <div className="flex items-center justify-between rounded-xl border border-[var(--color-intelligence-blue)]/40 bg-[var(--color-intelligence-blue)]/5 px-4 py-3">
            <span className="text-caption font-mono tracking-widest text-[var(--color-intelligence-blue)] uppercase">
              Yearly ⭐ Best value
            </span>
            <span className="text-right">
              <span className="block text-title font-semibold text-[var(--landing-ink)]">{plan.yearlyPrice}</span>
              {plan.yearlySavings ? (
                <span className="text-caption text-[var(--landing-ink-subtle)]">Save {plan.yearlySavings}</span>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>

      <ul className="m-0 flex flex-1 list-none flex-col gap-2.5 p-0">
        {plan.features.map((item) => (
          <li key={item} className="flex gap-2.5 text-small text-[var(--landing-ink-soft)]">
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--color-intelligence-blue)]" />
            {item}
          </li>
        ))}
      </ul>

      <Button asChild variant={plan.featured ? 'primary' : 'outline'} size="lg" className="rounded-full">
        <Link href="/signup">Start free trial</Link>
      </Button>
    </div>
  );
}

/**
 * The closing band. Get Started is the primary action; the waitlist is kept —
 * on request — as the path for someone who would rather be notified than open
 * an account today.
 */
function FinalCta() {
  return (
    <section className="py-16 md:py-24">
      <Reveal className="mx-auto max-w-3xl px-6">
        <div className="rounded-3xl border border-[var(--landing-border)] bg-[var(--landing-card)] px-8 py-14 text-center shadow-[var(--landing-shadow-lifted)] sm:px-14">
          <h2 className="font-serif text-3xl leading-tight font-normal text-[var(--landing-ink)] text-balance sm:text-4xl">
            Tomorrow morning, the list is already <Accent>made.</Accent>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-body text-[var(--landing-ink-soft)]">
            Create an account and connect one tool. Kloyya starts reading straight away.
          </p>

          <div className="mt-8 flex justify-center">
            <Button
              asChild
              size="lg"
              className="rounded-full px-8"
              trailingIcon={<ArrowRight aria-hidden="true" />}
            >
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
          <p className="mt-3 text-caption font-mono text-[var(--landing-ink-subtle)]">
            Free to start, no card required.
          </p>

          <div id="waitlist" className="mx-auto mt-12 max-w-md scroll-mt-24 border-t border-[var(--landing-border)] pt-8">
            <h3 className="text-title font-semibold text-[var(--landing-ink)]">Not ready for an account?</h3>
            <p className="mt-1.5 mb-4 text-small text-[var(--landing-ink-soft)]">
              Leave your address and we will email you when something worth knowing ships — new
              integrations, or the mobile apps. Nothing else.
            </p>
            <WaitlistForm source="landing-final" />
          </div>
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
        { label: 'Pricing', href: '#pricing' },
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
