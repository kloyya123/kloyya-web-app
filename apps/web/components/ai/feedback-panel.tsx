'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { FeedbackRating } from '@/types/domain';

/**
 * KDS AI Components: "Feedback Panel."
 * Product Principle 17 (Learn Continuously): corrections, approvals, and
 * rejections "improve future intelligence."
 *
 * Two axes, deliberately kept apart (see types/domain.ts):
 *   - *outcome* — what the user did with the recommendation (accept, dismiss…)
 *   - *rating*  — what the user thought of its quality
 *
 * This component owns only the rating. Conflating them, as the source documents
 * do, would make "dismissed" indistinguishable from "wrong", and the model would
 * learn the wrong lesson from a user who simply did not have time today.
 */

export interface FeedbackPanelProps {
  onRate: (rating: FeedbackRating) => void;
  /** Set once a rating has been recorded, so the control can acknowledge it. */
  currentRating?: FeedbackRating | undefined;
  className?: string;
}

export function FeedbackPanel({ onRate, currentRating, className }: FeedbackPanelProps) {
  const [rating, setRating] = useState<FeedbackRating | undefined>(currentRating);

  function record(next: FeedbackRating) {
    setRating(next);
    onRate(next);
  }

  if (rating) {
    return (
      <p className={cn('text-caption text-muted-foreground', className)} role="status">
        Thanks. Kloyya will weigh this when ranking similar work.
      </p>
    );
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <span className="text-caption text-muted-foreground mr-1">Was this useful?</span>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => record('helpful')}
        className="text-muted-foreground hover:text-positive size-8 p-0"
      >
        <ThumbsUp aria-hidden="true" />
        <span className="sr-only">Yes, this was useful</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => record('not_helpful')}
        className="text-muted-foreground hover:text-critical size-8 p-0"
      >
        <ThumbsDown aria-hidden="true" />
        <span className="sr-only">No, this was not useful</span>
      </Button>
    </div>
  );
}
