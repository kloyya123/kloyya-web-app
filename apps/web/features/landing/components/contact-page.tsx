import { CONTACT_CHANNELS, CONTACT_RESPONSE_TIME } from '../legal-content';

/** The Contact page — channels as cards, not prose, since the point is finding the right address fast. */
export function ContactPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <header className="mb-12 border-b border-[var(--landing-border)] pb-8">
        <h1 className="font-serif text-4xl leading-tight font-normal text-[var(--landing-ink)] sm:text-5xl">
          Contact Kloyya
        </h1>
        <p className="mt-4 text-body text-[var(--landing-ink-soft)]">We&rsquo;re here to help.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {CONTACT_CHANNELS.map((channel) => (
          <div
            key={channel.label}
            className="rounded-[var(--radius-lg)] border border-[var(--landing-border)] bg-[var(--landing-card)] p-5 shadow-[var(--landing-shadow-card)]"
          >
            <h2 className="text-title font-semibold text-[var(--landing-ink)]">{channel.label}</h2>
            <p className="mt-1.5 text-small text-[var(--landing-ink-soft)]">{channel.description}</p>
            <a
              href={`mailto:${channel.email}`}
              className="mt-3 inline-block text-small font-medium text-[var(--color-intelligence-blue)] hover:underline"
            >
              {channel.email}
            </a>
          </div>
        ))}
      </div>

      <p className="mt-10 text-small text-[var(--landing-ink-subtle)]">{CONTACT_RESPONSE_TIME}</p>
    </article>
  );
}
