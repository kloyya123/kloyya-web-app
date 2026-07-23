'use client';

import { ArrowUp, Calendar, FileStack, FolderKanban, Layers, Mail, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button, Card, Input } from '@/components/ui';
import { LogoMark } from '@/components/brand/logo';
import { cn } from '@/lib/cn';

type Scope = 'all' | 'email' | 'calendar' | 'documents' | 'projects';

const SCOPES: { id: Scope; label: string; icon: ReactNode; phrase?: string }[] = [
  { id: 'all', label: 'All sources', icon: <Layers aria-hidden="true" className="size-3.5" /> },
  { id: 'email', label: 'Email', icon: <Mail aria-hidden="true" className="size-3.5" />, phrase: 'my email' },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: <Calendar aria-hidden="true" className="size-3.5" />,
    phrase: 'my calendar',
  },
  {
    id: 'documents',
    label: 'Docs',
    icon: <FileStack aria-hidden="true" className="size-3.5" />,
    phrase: 'my documents',
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: <FolderKanban aria-hidden="true" className="size-3.5" />,
    phrase: 'my projects',
  },
];

/**
 * The dashboard's entry point into Ask Kloyya.
 *
 * A scope pill narrows the question in plain language ("Regarding my
 * calendar: …") rather than silently filtering — Ask Kloyya has no source
 * filter of its own, so the honest version of "scoping" is asking a more
 * specific question, not pretending to configure a search.
 */
export function AskBox() {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [scope, setScope] = useState<Scope>('all');

  function submit() {
    const trimmed = question.trim();
    if (trimmed.length === 0) return;
    const phrase = SCOPES.find((s) => s.id === scope)?.phrase;
    const finalQuestion = phrase ? `Regarding ${phrase}: ${trimmed}` : trimmed;
    router.push(`/ask?q=${encodeURIComponent(finalQuestion)}`);
  }

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center gap-2.5">
        <LogoMark decorative animated className="size-6" />
        <h2 className="text-title text-foreground font-semibold">Ask Kloyya anything</h2>
      </div>
      <p className="text-small text-muted-foreground -mt-2">
        Kloyya knows your work. Ask anything or get help with tasks.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="border-border focus-within:border-muted flex items-center gap-2 rounded-lg border py-2 pr-2 pl-3"
      >
        <Input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about your work…"
          aria-label="Ask Kloyya a question"
          className="min-w-0 flex-1 border-0 bg-transparent focus-visible:ring-0"
        />
        <Button
          type="submit"
          size="icon"
          className="ml-auto shrink-0 rounded-full"
          isDisabled={question.trim().length === 0}
        >
          <ArrowUp aria-hidden="true" />
          <span className="sr-only">Ask</span>
        </Button>
      </form>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ask scope">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={scope === s.id}
            onClick={() => setScope(s.id)}
            className={cn(
              'text-caption inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition-colors',
              scope === s.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
        {/* Matches the reference's trailing "+" affordance for adding a source
            scope. Sources are managed on the Connections page today, so it links
            there rather than opening a picker that doesn't exist yet. */}
        <Link
          href="/connections"
          aria-label="Add a source"
          className="border-border text-muted-foreground hover:text-foreground inline-flex items-center rounded-full border px-2 py-1 transition-colors"
        >
          <Plus aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </Card>
  );
}
