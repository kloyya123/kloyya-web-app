'use client';

import { ArrowUp, ExternalLink, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, CardContent, Textarea } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { formatRelativeTime } from '@/lib/format';
import { services, isApiError, type AskAnswer } from '@/services';

/**
 * Ask Kloyya.
 *
 * A question in, an evidence-backed answer out, with the sources cited beneath
 * it. The product's first principle is visible here: the answer never stands
 * alone — the "Sources" list is what Kloyya was allowed to use, drawn from the
 * user's own connected tools.
 *
 * Two failure modes get their own honest treatment rather than a red error box:
 * the assistant not being configured on this server (`ai_unconfigured`) and the
 * model host being briefly down (`ai_unavailable`). Neither is the user's fault,
 * and the copy says so.
 */
type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'answered'; answer: AskAnswer }
  | { kind: 'unconfigured' }
  | { kind: 'error'; message: string };

export function AskView() {
  const [question, setQuestion] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const trimmed = question.trim();
  const isLoading = phase.kind === 'loading';

  async function submit() {
    if (trimmed.length === 0 || isLoading) return;
    setPhase({ kind: 'loading' });
    trackEvent('ask_submitted', { length: trimmed.length });
    try {
      const answer = await services.ask.ask(trimmed);
      setPhase({ kind: 'answered', answer });
    } catch (error) {
      if (isApiError(error) && error.errorCode === 'ai_unconfigured') {
        setPhase({ kind: 'unconfigured' });
        return;
      }
      const message = isApiError(error)
        ? error.message
        : 'Something went wrong. Please try again.';
      setPhase({ kind: 'error', message });
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2 text-center">
        <span className="bg-primary/10 text-primary inline-flex size-11 items-center justify-center rounded-full">
          <Sparkles aria-hidden="true" className="size-5" />
        </span>
        <h1 className="text-heading-m text-foreground font-semibold">Ask Kloyya</h1>
        <p className="text-small text-muted-foreground mx-auto max-w-md">
          Ask anything about your work. Kloyya answers from your connected tools and shows you
          exactly where each answer came from.
        </p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="border-border bg-surface focus-within:border-muted rounded-lg border p-2 transition-colors">
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends; Shift+Enter is a newline.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder="What did we decide about the Q3 roadmap?"
            rows={2}
            aria-label="Ask Kloyya a question"
            className="border-0 bg-transparent focus-visible:ring-0"
          />
          <div className="flex justify-end px-1 pt-1">
            <Button
              type="submit"
              size="icon"
              isDisabled={trimmed.length === 0}
              isLoading={isLoading}
              loadingLabel="Thinking"
            >
              <ArrowUp aria-hidden="true" />
              <span className="sr-only">Ask</span>
            </Button>
          </div>
        </div>
      </form>

      {phase.kind === 'answered' ? <AnswerCard answer={phase.answer} /> : null}

      {phase.kind === 'unconfigured' ? (
        <Card>
          <CardContent className="space-y-2 py-6 text-center">
            <p className="text-body text-foreground font-medium">
              Ask Kloyya isn’t switched on here yet.
            </p>
            <p className="text-small text-muted-foreground mx-auto max-w-sm">
              This workspace doesn’t have an AI provider configured. Once a key is set, Kloyya can
              answer from your connected tools.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {phase.kind === 'error' ? (
        <Card>
          <CardContent className="py-6">
            <p role="alert" className="text-small text-critical text-center">
              {phase.message}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function AnswerCard({ answer }: { answer: AskAnswer }) {
  return (
    <Card>
      <CardContent className="space-y-5 py-6">
        <p className="text-body text-foreground whitespace-pre-wrap">{answer.answer}</p>

        {answer.citations.length > 0 ? (
          <section aria-labelledby="ask-sources" className="border-border border-t pt-4">
            <h2 id="ask-sources" className="text-caption text-subtle mb-3 font-medium uppercase">
              Sources
            </h2>
            <ul className="space-y-2">
              {answer.citations.map((citation, index) => (
                <li
                  key={`${citation.source}-${citation.label}-${index}`}
                  className="flex items-start gap-2.5"
                >
                  <ExternalLink aria-hidden="true" className="text-subtle mt-0.5 size-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="text-small text-foreground block truncate">
                      {citation.label}
                    </span>
                    <span className="text-caption text-subtle">
                      {citation.source} · updated {formatRelativeTime(citation.freshness)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="text-caption text-subtle border-border border-t pt-4">
            No sources matched — Kloyya answered from what little it could find, or told you it
            couldn’t. Connect more tools to give it more to draw on.
          </p>
        )}

        <p className="text-caption text-subtle">Answered by {answer.model}</p>
      </CardContent>
    </Card>
  );
}
