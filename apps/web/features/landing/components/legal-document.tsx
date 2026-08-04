import type { LegalDoc } from '../legal-content';

/** Renders a LegalDoc (Privacy Policy, Terms of Service) in the landing page's own register. */
export function LegalDocument({ doc }: { doc: LegalDoc }) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <header className="mb-12 border-b border-[var(--landing-border)] pb-8">
        <h1 className="font-serif text-4xl leading-tight font-normal text-[var(--landing-ink)] sm:text-5xl">
          {doc.title}
        </h1>
        <p className="mt-3 text-small font-mono text-[var(--landing-ink-subtle)] uppercase tracking-wide">
          Effective date: {doc.effectiveDate}
        </p>
        {doc.intro.map((paragraph) => (
          <p key={paragraph} className="mt-4 text-body text-[var(--landing-ink-soft)]">
            {paragraph}
          </p>
        ))}
      </header>

      <div className="space-y-10">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-title font-semibold text-[var(--landing-ink)]">{section.heading}</h2>
            <div className="mt-3 space-y-3">
              {section.blocks.map((block, index) => {
                const key = `${section.heading}-${index}`;
                if (block.type === 'h3') {
                  return (
                    <h3 key={key} className="pt-2 text-small font-semibold text-[var(--landing-ink)]">
                      {block.text}
                    </h3>
                  );
                }
                if (block.type === 'list') {
                  return (
                    <ul key={key} className="list-disc space-y-1.5 pl-5">
                      {block.items.map((item) => (
                        <li key={item} className="text-small text-[var(--landing-ink-soft)]">
                          {item}
                        </li>
                      ))}
                    </ul>
                  );
                }
                if (block.type === 'email') {
                  return (
                    <p key={key} className="text-small">
                      <a
                        href={`mailto:${block.address}`}
                        className="text-[var(--color-intelligence-blue)] hover:underline"
                      >
                        {block.address}
                      </a>
                    </p>
                  );
                }
                return (
                  <p key={key} className="text-small text-[var(--landing-ink-soft)]">
                    {block.text}
                  </p>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
