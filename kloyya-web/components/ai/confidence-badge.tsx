'use client';

import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { Badge, Tooltip, TooltipContent, TooltipTrigger, type BadgeTone } from '@/components/ui';
import { presentConfidence, type ConfidenceBand } from '@/lib/confidence';

/**
 * KDS AI Components: "AI Confidence Badge."
 * DCTF Golden Rule: "Never hide uncertainty."
 *
 * A bare percentage hides uncertainty behind a number: 62% and 94% look like the
 * same kind of fact. So the badge carries a band, an icon, and — on hover or
 * focus — the sentence that says what the number means.
 *
 * The tone mapping is deliberately not a gradient. Below the review threshold
 * the badge turns amber, because DCTF requires the UI to visibly caveat a
 * recommendation it cannot stand behind.
 */
const BAND_TONE: Record<ConfidenceBand, BadgeTone> = {
  high: 'ai',
  moderate: 'ai',
  limited: 'warning',
  low: 'warning',
};

const BAND_ICON = {
  high: ShieldCheck,
  moderate: ShieldCheck,
  limited: ShieldQuestion,
  low: ShieldAlert,
} as const;

export interface ConfidenceBadgeProps {
  /** 0–100. */
  confidence: number;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const { band, label, explanation, requiresReview } = presentConfidence(confidence);
  const Icon = BAND_ICON[band];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/*
          A button, not a span: the explanation must be reachable by keyboard.
          Tooltips are unavailable on touch, so the explanation is repeated in
          the reasoning panel — nothing load-bearing lives only here.
        */}
        <button type="button" className="rounded-full">
          <Badge tone={BAND_TONE[band]}>
            <Icon aria-hidden="true" className="size-3" />
            {label}
            {requiresReview ? <span className="sr-only">. Review before acting.</span> : null}
          </Badge>
        </button>
      </TooltipTrigger>
      <TooltipContent>{explanation}</TooltipContent>
    </Tooltip>
  );
}
