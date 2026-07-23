import { Lightbulb } from 'lucide-react';
import { SidebarCard } from './dashboard';

export interface ProductivityTip {
  headline: string;
  detail: string;
}

/**
 * A short productivity nudge about the user — the reference's "You've been more
 * productive on Tuesdays" slot. It reads real signals from the day (focus time,
 * high-priority load, meeting count) rather than fabricating an analytics claim,
 * so the encouragement is always true for the day it's shown.
 */
export function KloyyaTipCard({ tip }: { tip: ProductivityTip }) {
  return (
    <SidebarCard title="Kloyya Tip">
      <div className="flex gap-2.5">
        <Lightbulb aria-hidden="true" className="text-warning mt-0.5 size-4 shrink-0" />
        <div className="space-y-1">
          <p className="text-small text-foreground font-medium">{tip.headline}</p>
          <p className="text-caption text-subtle">{tip.detail}</p>
        </div>
      </div>
    </SidebarCard>
  );
}

/** Build the tip from the day's real signals. */
export function productivityTip(input: {
  focusHours: number;
  highPriorityCount: number;
  meetingCount: number;
}): ProductivityTip {
  const { focusHours, highPriorityCount, meetingCount } = input;

  if (focusHours >= 5) {
    return {
      headline: `You have ${focusHours.toFixed(1)}h of focus time today.`,
      detail: 'A light meeting load — a good day to move something big forward. Protect it.',
    };
  }
  if (highPriorityCount > 0) {
    return {
      headline: `${highPriorityCount} high-priority ${highPriorityCount === 1 ? 'task' : 'tasks'} to clear.`,
      detail: 'Knock these out first — momentum on the hard things carries the rest of the day.',
    };
  }
  if (meetingCount >= 4) {
    return {
      headline: 'A meeting-heavy day ahead.',
      detail: 'Block 30 minutes between calls to act on what you decide — decisions fade fast.',
    };
  }
  return {
    headline: 'You’re on top of things today.',
    detail: 'Nothing urgent is stacking up. A good moment to get ahead on something that matters.',
  };
}
