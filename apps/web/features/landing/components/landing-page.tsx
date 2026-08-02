import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo, LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CONTACT_EMAIL, FAQS, FEATURES, PLANS, ROLES, TOOLS } from '../content';
import { Reveal } from './reveal';
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
 * A signed-in visitor sees this page too. It is the company's front door, so
 * forwarding them to their dashboard would hide the pricing and FAQ from the
 * people most likely to look them up, and would turn a shared kloyya.com link
 * into someone else's dashboard.
 *
 * Layout: a ruled margin runs down the left with numbered section labels in it,
 * echoing what Kloyya does — reading the day and marking up what matters.
 */
export function LandingPage() {
  return (
    /* `light` pins the marketing page to the white KDS palette regardless of
       the visitor's system theme. The app itself defaults to dark at :root and
       lets people choose — but a landing page that changes colour depending on
       who is looking cannot be designed, screenshotted, or shared with any
       confidence about what the other person sees. The class scopes the light
       token set to this subtree only, so nothing inside the product moves. */
    <div className="light bg-background text-foreground min-h-dvh">
      <SiteHeader />

      <main id="main">
        <Hero />


        <Section index="02" label="Product" title="Kloyya in action">
          <Lede>Three screens you will live in. Nothing here is a placeholder.</Lede>
          <ProductScreens />
        </Section>

        <Section index="03" label="What it does" title="Five jobs, done quietly">
          <Lede>Kloyya does not ask for a new workflow. It reads the one you have.</Lede>
          {/* Cards rather than the ruled rows this used to be: five headings
              stacked down the page read as a spec sheet and get skimmed past.
              The first card spans two columns because "reads your mail" is the
              one that has to land — the rest only matter once it does. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <article
                key={feature.title}
                className={cn(
                  'border-border bg-background hover:border-link/40 flex flex-col gap-2 rounded-lg border p-6 transition-colors',
                  index === 0 && 'sm:col-span-2',
                )}
              >
                <span className="text-caption text-link font-mono tracking-widest uppercase">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="text-title text-foreground font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground m-0">{feature.body}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section index="04" label="Who it's for" title="Six versions of the same problem">
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

        <Section index="05" label="Connects" title="Bring your own tools" anchor="tools">
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

        <Section index="06" label="Pricing" title="Two plans. That is the whole menu." anchor="pricing">
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
                  <a href="#waitlist">{plan.featured ? 'Get Pro at launch' : 'Join the waitlist'}</a>
                </Button>
              </div>
            ))}
          </div>
          <p className="text-caption text-subtle mt-4 font-mono">
            Free is free, and it stays free. Upgrade to Pro whenever you want more.
          </p>
        </Section>

        <Section index="07" label="Questions" title="Fair questions" anchor="faq">
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
              <a href="#waitlist">Join the waitlist</a>
            </Button>
          </div>

          {/* The list is a queue for access again: sign-up is closed while the
              connectors are being proven, so this is the only way in. Worded as
              a queue rather than a newsletter, because that is what it is. */}
          <div id="waitlist" className="border-border/60 mt-10 scroll-mt-24 border-t pt-8">
            <h3 className="text-title text-foreground mb-1.5 font-semibold">
              Get early access
            </h3>
            <p className="text-small text-muted-foreground mb-4">
              Kloyya is not open to everyone yet. Leave your address and we will email you when
              your place is ready — nothing else, and never to anyone else.
            </p>
            <WaitlistForm source="landing" />
          </div>
        </Section>

        <Section index="10" label="Start" title="Tomorrow morning, the list is already made." center>
          <Lede center>
            Connect one tool and see what Kloyya finds. It takes about two minutes.
          </Lede>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" trailingIcon={<ArrowRight aria-hidden="true" />}>
              <a href="#waitlist">Join the waitlist</a>
            </Button>
          </div>
          <p className="text-caption text-subtle mt-4 font-mono">
            Free when it opens, no card. We will email you the moment there is a place for you.
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
          {/* Sign-in and sign-up are deliberately absent while Kloyya is
              closed. Showing a login form for a product nobody can join yet
              invites people to try credentials they do not have; one action
              that works beats two that mostly do not. The /login and /signup
              routes still exist and still work — they are simply not advertised
              here — so testing continues without a special path back in. */}
          <a
            href="#waitlist"
            className="bg-intelligence-blue text-on-intelligence-blue rounded-sm px-3 py-1.5 transition-colors hover:bg-intelligence-blue/90"
          >
            Join the waitlist
          </a>
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
          background: [
            /**
             * Kloyya's own palette rather than the reference's pink-and-mint.
             *
             * The reference washes two unrelated warm and cool blooms across a
             * white field, which looks pleasant and says nothing — swap the logo
             * and it belongs to any startup. This is built from the product's
             * actual tokens: intelligence blue as the anchor, executive purple
             * beside it, and one warm ember far enough away to keep the whole
             * thing from reading cold. The result is recognisably Kloyya at a
             * glance, which is the only job a hero gradient has.
             *
             * Ordered back-to-front, with the white core listed FIRST so it is
             * painted underneath: colour stays at the edges and the headline and
             * waitlist field always sit on plain white.
             */
            'radial-gradient(64% 56% at 46% 26%, var(--color-background) 38%, transparent 76%)',
            'radial-gradient(46% 62% at 4% -6%, color-mix(in srgb, var(--color-executive-purple) 30%, transparent), transparent 66%)',
            'radial-gradient(40% 50% at 16% 2%, color-mix(in srgb, var(--color-intelligence-blue) 26%, transparent), transparent 62%)',
            'radial-gradient(52% 64% at 98% -4%, color-mix(in srgb, var(--color-intelligence-blue) 34%, transparent), transparent 68%)',
            'radial-gradient(34% 44% at 86% 10%, color-mix(in srgb, var(--color-notice) 22%, transparent), transparent 62%)',
            'radial-gradient(30% 38% at 70% 2%, color-mix(in srgb, var(--color-caution) 14%, transparent), transparent 60%)',
            'linear-gradient(180deg, color-mix(in srgb, var(--color-intelligence-blue) 5%, transparent), transparent 42%)',
          ].join(', '),
        }}
      />

      <div className="mx-auto max-w-content px-6 py-20 md:py-28">
        <span className="text-caption text-subtle font-mono tracking-widest uppercase">
          Kloyya / 01
        </span>

        <h1 className="text-foreground mt-6 max-w-3xl text-4xl leading-[1.08] font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]">
          One morning briefing,
          <br />
          <span className="text-muted-foreground">every tool you use.</span>
        </h1>

        <p className="text-body text-muted-foreground mt-5 max-w-md">
          Connect your mail, calendar, and documents. Kloyya works through the noise overnight and
          hands you the short list — then drafts the replies and waits for your nod before anything
          is sent.
        </p>

        {/* The one action available while Kloyya is closed, put where the
            reference design puts it: in the hero, not at the bottom of a page
            most visitors will never reach. */}
        <div className="mt-8 max-w-md">
          <WaitlistForm source="landing-hero" />
          <p className="text-caption text-subtle mt-3 font-mono">
            Free when it opens. No card. We email you once, when your place is ready.
          </p>
        </div>

        <Reveal delay={120} className="mx-auto mt-14 max-w-4xl">
          <HeroBriefing />
        </Reveal>
      </div>

      <ToolStrip />
    </section>
  );
}

/**
 * The strip under the hero: the tools Kloyya connects to.
 *
 * The reference design puts customer logos here. Kloyya has no customers who
 * have agreed to be named, and borrowed logos are the fastest possible way to
 * lose the trust this whole product is selling — so this says the true version
 * of the same thing. "Works with what you already use" is the reassurance a
 * visitor is actually looking for at this point on the page, and every name
 * here is a connector that exists.
 */
function ToolStrip() {
  const live = TOOLS.filter((tool) => tool.live);
  return (
    <div className="border-border bg-surface/40 border-t">
      <div className="mx-auto max-w-content px-6 py-6">
        <p className="text-caption text-subtle mb-4 text-center font-mono tracking-widest uppercase">
          Works with what you already use
        </p>
        <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-x-10 gap-y-3 p-0">
          {live.map((tool) => (
            <li
              key={tool.name}
              className="text-body text-muted-foreground font-medium whitespace-nowrap"
            >
              {tool.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
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

        {/* One Reveal per section rather than per element: the whole block
            arriving together reads as a page turning, where staggering every
            card turns scrolling into a slot machine. */}
        <Reveal className={cn('py-8 md:py-18 md:pl-10', center && 'text-center')}>
          <h2 className="text-heading-l text-foreground mb-3 font-semibold tracking-tight text-balance">
            {title}
          </h2>
          {children}
        </Reveal>
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
