import { ArrowRight, Check, Play } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo, LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CONTACT_EMAIL, FAQS, FEATURES, PLANS, ROLES, TOOLS } from '../content';
import { DemoPlayer } from './demo-player';
import { WaitlistForm } from './waitlist-form';
import { HeroBriefing, ProductScreens } from './product-screens';
import { SocialLinks } from './social-links';

/**
 * Kloyya's public front door.
 *
 * `/` used to redirect straight to /login, on the basis that the marketing site
 * lived in a separate repository. It now lives here, on the same domain, so a
 * visitor who has never heard of Kloyya gets an explanation before a password
 * field — and so the app's own KDS tokens keep the two surfaces identical.
 * Middleware still forwards a signed-in visitor to their dashboard, so this
 * page is only ever seen by someone who is not already using the product.
 *
 * Layout: a ruled margin runs down the left with numbered section labels in it,
 * echoing what Kloyya does — reading the day and marking up what matters.
 */
export function LandingPage() {
  return (
    <div className="bg-background text-foreground min-h-dvh">
      <SiteHeader />

      <main id="main">
        <Hero />

        <Section index="02" label="Demo" title="Watch Kloyya work">
          <Lede>
            One real question, one drafted reply, nothing sent without you. Pick a device and
            press play.
          </Lede>
          <DemoPlayer />
        </Section>

        <Section index="03" label="Product" title="Kloyya in action">
          <Lede>Three screens you will live in. Nothing here is a placeholder.</Lede>
          <ProductScreens />
        </Section>

        <Section index="04" label="What it does" title="Five jobs, done quietly">
          <Lede>Kloyya does not ask for a new workflow. It reads the one you have.</Lede>
          <div className="border-border border-t">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="border-border/60 hover:bg-surface grid items-baseline gap-2 border-b py-6 transition-colors sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-6"
              >
                <h3 className="text-title text-foreground font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground m-0">{feature.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section index="05" label="Who it's for" title="Six versions of the same problem">
          <Lede>Too much arriving, too little of it yours.</Lede>
          <div className="border-border bg-border grid gap-px border sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((role) => (
              <div key={role.name} className="bg-background hover:bg-surface p-6 transition-colors">
                <span className="text-caption text-link mb-2 block font-mono tracking-widest uppercase">
                  {role.name}
                </span>
                <p className="text-muted-foreground m-0">{role.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section index="06" label="Connects" title="Bring your own tools" anchor="tools">
          <Lede>
            Read access by default. Anything that acts — sending, declining, replying — stays off
            until you switch it on, and is revocable in one click.
          </Lede>
          <div className="border-border bg-border grid gap-px border sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((tool) => (
              <div
                key={tool.name}
                className="bg-background hover:bg-surface flex items-center justify-between gap-4 p-5 transition-colors"
              >
                <span className="text-body text-foreground">{tool.name}</span>
                <span
                  className={cn(
                    'text-caption inline-flex items-center gap-2 font-mono tracking-wider whitespace-nowrap uppercase',
                    tool.live ? 'text-positive' : 'text-subtle',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-1.5 rounded-full',
                      tool.live ? 'bg-positive ring-positive/25 ring-3' : 'bg-subtle',
                    )}
                  />
                  {tool.live ? 'Live' : 'Next'}
                </span>
              </div>
            ))}
          </div>
          <p className="text-caption text-subtle mt-4 font-mono">
            Missing something you rely on?{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-link rounded-sm hover:underline">
              Tell us and we will build it.
            </a>
          </p>
        </Section>

        <Section index="07" label="Pricing" title="Two plans. That is the whole menu." anchor="pricing">
          <Lede>Free is a real product, not a countdown to a paywall.</Lede>
          <div className="border-border bg-border grid max-w-3xl gap-px border sm:grid-cols-2">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  'flex flex-col gap-5 p-7',
                  plan.featured
                    ? 'bg-surface shadow-[inset_0_2px_0_var(--color-intelligence-blue)]'
                    : 'bg-background',
                )}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span
                    className={cn(
                      'text-caption font-mono tracking-widest uppercase',
                      plan.featured ? 'text-link' : 'text-subtle',
                    )}
                  >
                    {plan.name}
                  </span>
                  <span className="text-heading-l text-foreground font-semibold">
                    {plan.price}
                    {plan.period ? (
                      <span className="text-caption text-subtle font-mono">{plan.period}</span>
                    ) : null}
                  </span>
                </div>

                <ul className="m-0 flex flex-1 list-none flex-col gap-2.5 p-0">
                  {plan.features.map((item) => (
                    <li key={item} className="text-small text-muted-foreground flex gap-2.5">
                      <Check aria-hidden="true" className="text-link mt-0.5 size-4 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>

                <Button asChild variant={plan.featured ? 'primary' : 'outline'} size="lg">
                  <Link href="/signup">{plan.featured ? 'Get Pro' : 'Get started free'}</Link>
                </Button>
              </div>
            ))}
          </div>
          <p className="text-caption text-subtle mt-4 font-mono">
            Free is free, and it stays free. Upgrade to Pro whenever you want more.
          </p>
        </Section>

        <Section index="08" label="Questions" title="Fair questions" anchor="faq">
          <Lede>
            Mostly about your data and what Kloyya is allowed to do, which is the right thing to
            ask about.
          </Lede>
          <div className="border-border max-w-3xl border-t">
            {FAQS.map((faq, index) => (
              <details
                key={faq.q}
                open={index === 0}
                className="border-border/60 group border-b"
              >
                <summary className="text-body text-foreground marker:content-none hover:text-link flex cursor-pointer list-none items-center justify-between gap-4 py-4 transition-colors">
                  {faq.q}
                  <span
                    aria-hidden="true"
                    className="text-link shrink-0 font-mono transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="text-small text-muted-foreground m-0 max-w-[60ch] pb-5">{faq.a}</p>
              </details>
            ))}
          </div>
        </Section>

        <Section index="09" label="Get started" title="Three steps to your first briefing" anchor="access">
          <Lede>
            Creating an account takes a minute and costs nothing. Connect one tool and Kloyya
            starts reading straight away.
          </Lede>

          <div className="border-border bg-border grid max-w-3xl gap-px border sm:grid-cols-3">
            {[
              { step: '01', title: 'Create your account', body: 'Email and a password. No card, and the free plan does not expire.' },
              { step: '02', title: 'Connect a tool', body: 'Gmail, Calendar, Drive or Notion. Read access only, revocable in one click.' },
              { step: '03', title: 'Read your briefing', body: 'Kloyya works through what it found and hands you the short list.' },
            ].map((item) => (
              <div key={item.step} className="bg-background p-6">
                <span className="text-caption text-link mb-2 block font-mono tracking-widest uppercase">
                  {item.step}
                </span>
                <h3 className="text-title text-foreground mb-1.5 font-semibold">{item.title}</h3>
                <p className="text-small text-muted-foreground m-0">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" trailingIcon={<ArrowRight aria-hidden="true" />}>
              <Link href="/signup">Create your account</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>

          {/* The list is no longer a queue for access — anyone can sign up now —
              so it is offered to people who want news rather than an account. */}
          <div className="border-border/60 mt-10 border-t pt-8">
            <h3 className="text-title text-foreground mb-1.5 font-semibold">
              Not ready for an account?
            </h3>
            <p className="text-small text-muted-foreground mb-4">
              Leave your address and we will email you when something worth knowing ships —
              new integrations, or the mobile apps. Nothing else.
            </p>
            <WaitlistForm source="landing-updates" />
          </div>
        </Section>

        <Section index="10" label="Start" title="Tomorrow morning, the list is already made." center>
          <Lede center>
            Connect one tool and see what Kloyya finds. It takes about two minutes.
          </Lede>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" trailingIcon={<ArrowRight aria-hidden="true" />}>
              <Link href="/signup">Get started free</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <p className="text-caption text-subtle mt-4 font-mono">
            Free to start, no card. Connect a tool and see what Kloyya finds.
          </p>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}

/* ---------------------------------------------------------------- chrome */

function SiteHeader() {
  return (
    <header className="bg-background/85 border-border sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-6 py-3.5">
        {/* The real mark, not a stand-in: the same component the product uses,
            so the brand cannot drift between the marketing page and the app. */}
        <Link href="/" className="rounded-sm" aria-label="Kloyya home">
          <Logo />
        </Link>

        <nav className="text-caption flex items-center gap-6 font-mono tracking-wider uppercase">
          <a href="#tools" className="text-muted-foreground hover:text-foreground hidden rounded-sm sm:inline">
            Integrations
          </a>
          <a href="#pricing" className="text-muted-foreground hover:text-foreground hidden rounded-sm sm:inline">
            Pricing
          </a>
          <a href="#faq" className="text-muted-foreground hover:text-foreground hidden rounded-sm sm:inline">
            FAQ
          </a>
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground rounded-sm transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="bg-intelligence-blue text-on-intelligence-blue rounded-sm px-3 py-1.5 transition-colors hover:bg-intelligence-blue/90"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="border-border relative border-b">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(42% 44% at 72% 34%, color-mix(in srgb, var(--color-intelligence-blue) 16%, transparent), transparent 70%), radial-gradient(38% 40% at 38% 72%, color-mix(in srgb, var(--color-executive-purple) 13%, transparent), transparent 72%)',
        }}
      />

      <div className="mx-auto grid max-w-content px-6 md:grid-cols-[9rem_minmax(0,1fr)]">
        <div className="border-border pt-12 md:border-r md:py-20 md:pr-6">
          <span className="text-caption text-subtle font-mono tracking-widest uppercase md:block md:text-right">
            Kloyya / 01
          </span>
        </div>

        <div className="grid items-center gap-12 py-12 md:py-20 md:pl-10 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <h1 className="text-foreground text-4xl leading-[1.1] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Your chief of staff reads the day{' '}
              <span className="text-link">before you do.</span>
            </h1>

            <p className="text-body-lg text-muted-foreground mt-6 max-w-xl">
              Connect your mail, calendar, and documents. Kloyya works through the noise overnight
              and hands you the short list — then drafts the replies and waits for your nod before
              anything is sent.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" trailingIcon={<ArrowRight aria-hidden="true" />}>
                <Link href="/signup">Get started free</Link>
              </Button>
              <Button asChild variant="outline" size="lg" leadingIcon={<Play aria-hidden="true" />}>
                <a href="#demo">Watch the demo</a>
              </Button>
            </div>

            <p className="text-caption text-subtle mt-4 font-mono">
              Free to start. No card required. The free plan does not expire.
            </p>
          </div>

          <HeroBriefing />
        </div>
      </div>
    </section>
  );
}

/** One ruled section: a numbered label in the margin, content in the column. */
function Section({
  index,
  label,
  title,
  anchor,
  center,
  children,
}: {
  index: string;
  label: string;
  title: string;
  anchor?: string;
  center?: boolean;
  children: ReactNode;
}) {
  const id = anchor ?? label.toLowerCase().replace(/[^a-z]+/g, '-');

  return (
    <section id={id} className="border-border scroll-mt-16 border-b">
      <div className="mx-auto grid max-w-content px-6 md:grid-cols-[9rem_minmax(0,1fr)]">
        <div className="border-border pt-12 md:border-r md:py-18 md:pr-6">
          <span className="text-caption text-subtle sticky top-20 font-mono tracking-widest uppercase md:block md:text-right">
            {label} / {index}
          </span>
        </div>

        <div className={cn('py-8 md:py-18 md:pl-10', center && 'text-center')}>
          <h2 className="text-heading-l text-foreground mb-3 font-semibold tracking-tight text-balance">
            {title}
          </h2>
          {children}
        </div>
      </div>
    </section>
  );
}

function Lede({ children, center }: { children: ReactNode; center?: boolean }) {
  return (
    <p className={cn('text-muted-foreground mb-8 max-w-2xl', center && 'mx-auto')}>{children}</p>
  );
}

function SiteFooter() {
  const columns: { heading: string; links: { label: string; href: string }[] }[] = [
    {
      heading: 'Product',
      links: [
        { label: 'Overview', href: '#product' },
        { label: 'Demo', href: '#demo' },
        { label: 'Integrations', href: '#tools' },
        { label: 'Pricing', href: '#pricing' },
      ],
    },
    {
      heading: 'Company',
      links: [
        { label: 'Contact', href: `mailto:${CONTACT_EMAIL}` },
      ],
    },
    {
      heading: 'Resources',
      links: [
        { label: 'Help', href: '/help' },
        { label: 'FAQ', href: '#faq' },
        { label: 'Trust Centre', href: '/trust' },
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
    <footer className="bg-surface border-border border-t">
      <div className="mx-auto max-w-content px-6">
        <div className="grid gap-8 py-12 sm:grid-cols-3 lg:grid-cols-5">
          {columns.map((column) => (
            <div key={column.heading}>
              <h2 className="text-caption text-subtle mb-3 font-mono font-medium tracking-widest uppercase">
                {column.heading}
              </h2>
              {column.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-small text-muted-foreground hover:text-link block rounded-sm py-1 transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}

          <div>
            <h2 className="text-caption text-subtle mb-3 font-mono font-medium tracking-widest uppercase">
              Follow
            </h2>
            <SocialLinks />
          </div>
        </div>

        <div className="border-border text-caption text-subtle flex flex-wrap items-center justify-between gap-4 border-t py-5 font-mono">
          <span className="flex items-center gap-2.5">
            <LogoMark decorative className="size-5" />© 2026 Kloyya Inc. All rights reserved.
          </span>
          <span>Built for people with too much arriving.</span>
        </div>
      </div>
    </footer>
  );
}
