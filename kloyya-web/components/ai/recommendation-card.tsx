'use client';

import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown, Clock, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Separator,
  type BadgeTone,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import type {
  FeedbackRating,
  PriorityLevel,
  Recommendation,
  RecommendationOutcome,
  RiskLevel,
} from '@/types/domain';
import { ConfidenceBadge } from './confidence-badge';
import { EvidenceViewer } from './evidence-viewer';
import { FeedbackPanel } from './feedback-panel';
import { ReasoningPanel } from './reasoning-panel';
import { RetrievalTransparency } from './retrieval-transparency';

/**
 * KDS AI Components: "Recommendation Card."
 *
 * The DCTF Decision Quality Checklist, made structural. Because `Recommendation`
 * requires non-empty evidence and reasoning, this component cannot be rendered
 * for something that fails the checklist. There is no `if (evidence) {…}` here,
 * because there is no branch to write.
 *
 * Progressive disclosure, per the Design Manifesto's ladder:
 *   collapsed → title, why, confidence, the action
 *   expanded  → reasoning, assumptions, conflicts, evidence, cost of ignoring
 *
 * Principle 8 (AI augments, never replaces): the user can always accept,
 * dismiss, or postpone. Nothing here decides on their behalf.
 */

const RISK_TONE: Record<RiskLevel, BadgeTone> = {
  Low: 'neutral',
  Medium: 'info',
  High: 'warning',
  Critical: 'danger',
};

const PRIORITY_TONE: Record<PriorityLevel, BadgeTone> = {
  Critical: 'danger',
  High: 'warning',
  Medium: 'info',
  Low: 'neutral',
  Background: 'neutral',
};

export interface RecommendationCardProps {
  recommendation: Recommendation;
  onOutcome?: (id: string, outcome: RecommendationOutcome) => void;
  onRate?: (id: string, rating: FeedbackRating) => void;
  /** Start expanded. Used for the single highest-priority item on the dashboard. */
  defaultExpanded?: boolean;
  className?: string;
}

export function RecommendationCard({
  recommendation: rec,
  onOutcome,
  onRate,
  defaultExpanded = false,
  className,
}: RecommendationCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isConfirming, setIsConfirming] = useState(false);

  const isResolved = rec.outcome !== 'pending';

  function accept() {
    // DCTF Stage 7: "Never automate destructive actions without user approval."
    if ((rec.confirmationRequired || rec.suggestedAction.isDestructive) && !isConfirming) {
      setIsConfirming(true);
      return;
    }
    onOutcome?.(rec.id, 'accepted');
  }

  return (
    <Card className={cn(isResolved && 'opacity-60', className)}>
      <CardHeader className="flex-col items-stretch gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={PRIORITY_TONE[rec.priority]} withDot>
            {rec.priority}
          </Badge>
          <Badge tone={RISK_TONE[rec.risk]}>{rec.risk} risk</Badge>
          <ConfidenceBadge confidence={rec.confidence} />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-body-lg text-foreground font-semibold text-balance">
            {rec.title}
          </h3>
          <p className="text-small text-muted-foreground">{rec.reason}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Principle 16: every recommendation states its expected outcome. */}
        <dl className="space-y-2">
          <div>
            <dt className="text-caption text-muted-foreground">If you act</dt>
            <dd className="text-small text-foreground">{rec.expectedOutcome}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">If you don&rsquo;t</dt>
            <dd className="text-small text-foreground">{rec.whatHappensIfIgnored}</dd>
          </div>
        </dl>

        <Collapsible.Root open={isExpanded} onOpenChange={setIsExpanded}>
          <Collapsible.Trigger asChild>
            <button
              type="button"
              className="text-caption text-link flex items-center gap-1 rounded-sm font-medium hover:underline"
            >
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  'size-3.5 transition-transform duration-200',
                  isExpanded && 'rotate-180',
                )}
              />
              {isExpanded ? 'Hide the reasoning' : 'Why is Kloyya suggesting this?'}
            </button>
          </Collapsible.Trigger>

          <Collapsible.Content className="pt-4">
            <div className="border-border space-y-5 rounded-md border p-4">
              <ReasoningPanel
                reasoning={rec.reasoning}
                evidence={rec.evidence}
                assumptions={rec.assumptions}
                conflicts={rec.conflicts}
              />
              <Separator />
              <EvidenceViewer evidence={rec.evidence} />
              <Separator />
              {/* The retrieval story: which sources were used, which were not
                  and why, and how complete the picture was. Fetched only while
                  expanded. */}
              <RetrievalTransparency recommendationId={rec.id} enabled={isExpanded} />
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      </CardContent>

      <CardFooter className="flex-wrap justify-between gap-3">
        {isResolved ? (
          <p className="text-caption text-muted-foreground" role="status">
            You {rec.outcome} this.
          </p>
        ) : isConfirming ? (
          <ConfirmAction
            label={rec.suggestedAction.label}
            isDestructive={rec.suggestedAction.isDestructive}
            onConfirm={() => onOutcome?.(rec.id, 'accepted')}
            onCancel={() => setIsConfirming(false)}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {rec.suggestedAction.href ? (
                <Button asChild size="sm">
                  <Link href={rec.suggestedAction.href}>{rec.suggestedAction.label}</Link>
                </Button>
              ) : (
                <Button size="sm" onClick={accept}>
                  {rec.suggestedAction.label}
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOutcome?.(rec.id, 'postponed')}
                leadingIcon={<Clock aria-hidden="true" />}
              >
                Later
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOutcome?.(rec.id, 'dismissed')}
                leadingIcon={<X aria-hidden="true" />}
              >
                Dismiss
              </Button>
            </div>

            <FeedbackPanel
              currentRating={rec.feedbackRating}
              onRate={(rating) => onRate?.(rec.id, rating)}
            />
          </>
        )}
      </CardFooter>
    </Card>
  );
}

/**
 * The confirmation step for a destructive or low-confidence action.
 * Named after the action rather than "Confirm", so the button still says what
 * it does — the vocabulary of the interface stays stable through the flow.
 */
function ConfirmAction({
  label,
  isDestructive,
  onConfirm,
  onCancel,
}: {
  label: string;
  isDestructive: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="group" aria-label="Confirm this action" className="flex items-center gap-2">
      <p className="text-caption text-muted-foreground mr-1">
        {isDestructive ? 'This cannot be undone.' : 'Confirm before Kloyya acts.'}
      </p>
      <Button
        size="sm"
        variant={isDestructive ? 'danger' : 'primary'}
        onClick={onConfirm}
        autoFocus
      >
        {label}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
