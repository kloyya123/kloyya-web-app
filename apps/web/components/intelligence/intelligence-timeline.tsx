'use client';

import * as Collapsible from '@radix-ui/react-collapsible';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import type { PipelineStage } from '@/types/sources';

/**
 * The Intelligence Timeline.
 *
 * The spec: "Instead of hiding retrieval behind a spinner, visualize the
 * reasoning process… Users can expand any step to inspect details." So each
 * stage shows its time, its state, and — on expand — what it did.
 *
 * This is a pure view over pipeline state. It renders whatever it is handed,
 * whether that comes from the mock timer or a real event stream.
 */
export function IntelligenceTimeline({
  stages,
  className,
}: {
  stages: PipelineStage[];
  className?: string;
}) {
  return (
    <ol className={cn('space-y-0', className)} aria-label="Reasoning timeline">
      {stages.map((stage, index) => (
        <TimelineStep
          key={stage.kind}
          stage={stage}
          isLast={index === stages.length - 1}
        />
      ))}
    </ol>
  );
}

function TimelineStep({ stage, isLast }: { stage: PipelineStage; isLast: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const timestamp = stage.startedAt ?? stage.completedAt;

  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {/* The connecting rail. Absent on the last step so it does not dangle. */}
      {!isLast ? (
        <span
          aria-hidden="true"
          className="bg-border absolute top-6 left-[11px] h-full w-px"
        />
      ) : null}

      <StepMarker status={stage.status} />

      <div className="min-w-0 flex-1 pt-0.5">
        <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
          <Collapsible.Trigger asChild>
            <button
              type="button"
              className="group flex w-full items-center justify-between gap-2 rounded-sm text-left"
            >
              <span className="flex items-baseline gap-2">
                <span
                  className={cn(
                    'text-small font-medium',
                    stage.status === 'pending' ? 'text-subtle' : 'text-foreground',
                  )}
                >
                  {stage.label}
                </span>
                {timestamp ? (
                  <time
                    dateTime={timestamp}
                    className="text-caption text-subtle tabular-nums"
                  >
                    {formatTime(timestamp)}
                  </time>
                ) : null}
              </span>

              {stage.detail ? (
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    'text-subtle size-3.5 shrink-0 transition-transform duration-200',
                    isOpen && 'rotate-180',
                  )}
                />
              ) : null}
              <span className="sr-only">{stage.detail ? 'Show detail' : ''}</span>
            </button>
          </Collapsible.Trigger>

          {stage.detail ? (
            <Collapsible.Content>
              <p className="text-caption text-muted-foreground mt-1.5">{stage.detail}</p>
            </Collapsible.Content>
          ) : null}
        </Collapsible.Root>
      </div>
    </li>
  );
}

function StepMarker({ status }: { status: PipelineStage['status'] }) {
  if (status === 'complete') {
    return (
      <span className="bg-positive/15 text-positive relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full">
        <Check aria-hidden="true" className="size-3.5" />
        <span className="sr-only">Complete</span>
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="bg-link/15 text-link relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full">
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        <span className="sr-only">In progress</span>
      </span>
    );
  }
  return (
    <span className="border-border bg-card relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border">
      <span aria-hidden="true" className="bg-subtle size-1.5 rounded-full" />
      <span className="sr-only">Pending</span>
    </span>
  );
}
