'use client';

import { AlertTriangle, CornerDownRight } from 'lucide-react';
import { Badge, Separator } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Conflict, Evidence, NonEmpty, ReasoningStep } from '@/types/domain';

/**
 * KDS AI Components: "Reasoning Panel."
 * KARE: a recommendation must answer "what happened, why it matters, what to do,
 * and why that is trustworthy."
 *
 * The panel renders the chain, and — importantly — marks the steps that rest on
 * *no* evidence. Those are inferences. DCTF forbids fabricating information, and
 * an inference presented as a fact is how fabrication looks from the outside.
 */

export interface ReasoningPanelProps {
  reasoning: NonEmpty<ReasoningStep>;
  evidence: NonEmpty<Evidence>;
  assumptions: string[];
  conflicts: Conflict[];
  className?: string;
}

export function ReasoningPanel({
  reasoning,
  evidence,
  assumptions,
  conflicts,
  className,
}: ReasoningPanelProps) {
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));

  return (
    <div className={cn('space-y-5', className)}>
      {/* DCTF Golden Rule: "Never ignore conflicting data." Conflicts come first. */}
      {conflicts.length > 0 ? (
        <div className="space-y-2">
          {conflicts.map((conflict) => (
            <ConflictNotice key={conflict.id} conflict={conflict} />
          ))}
        </div>
      ) : null}

      <section>
        <h4 className="text-caption text-muted-foreground mb-3 font-medium tracking-wide uppercase">
          How Kloyya reached this
        </h4>
        <ol className="space-y-3">
          {reasoning.map((step, index) => (
            <li key={step.id} className="flex gap-3">
              <span
                aria-hidden="true"
                className="bg-hover text-caption text-muted-foreground mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full font-medium tabular-nums"
              >
                {index + 1}
              </span>

              <div className="min-w-0 space-y-1.5">
                <p className="text-small text-foreground">{step.statement}</p>

                {step.evidenceIds.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {step.evidenceIds.map((id) => {
                      const source = evidenceById.get(id);
                      // A dangling reference is a data bug, not a render crash.
                      if (!source) return null;
                      return (
                        <li key={id}>
                          <Badge tone="neutral">{source.sourceLabel}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-caption text-subtle flex items-center gap-1.5">
                    <CornerDownRight aria-hidden="true" className="size-3" />
                    Inferred from the steps above, not from a source.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {assumptions.length > 0 ? (
        <>
          <Separator />
          <section>
            <h4 className="text-caption text-muted-foreground mb-2 font-medium tracking-wide uppercase">
              Assuming
            </h4>
            <ul className="space-y-1.5">
              {assumptions.map((assumption) => (
                <li key={assumption} className="text-small text-muted-foreground flex gap-2">
                  <span aria-hidden="true" className="text-subtle">
                    &middot;
                  </span>
                  {assumption}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

function ConflictNotice({ conflict }: { conflict: Conflict }) {
  return (
    <div className="border-warning/30 bg-warning/10 flex items-start gap-3 rounded-sm border px-3 py-2.5">
      <AlertTriangle aria-hidden="true" className="text-caution mt-0.5 size-4 shrink-0" />
      <div className="space-y-1">
        <p className="text-small text-foreground font-medium">
          Conflicting information detected
        </p>
        <p className="text-caption text-muted-foreground">{conflict.summary}</p>
        <p className="text-caption text-muted-foreground">
          <span className="text-foreground font-medium">Suggested:</span>{' '}
          {conflict.recommendedResolution}
        </p>
      </div>
    </div>
  );
}
