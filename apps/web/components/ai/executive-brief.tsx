import { Card, CardContent, CardHeader } from '@/components/ui';
import { formatRelativeTime } from '@/lib/format';
import type { Briefing } from '@/types/domain';
import { ConfidenceBadge } from './confidence-badge';

/**
 * KDS AI Components: "Executive Brief."
 *
 * Design Manifesto: "The dashboard is not a homepage. It is today's executive
 * briefing." This is the one element on the dashboard permitted to be large,
 * because it answers the three questions every screen must answer — what
 * matters, what changed, what to do next — in a single paragraph.
 *
 * Its confidence is shown for the same reason a recommendation's is: a briefing
 * is a claim about the world, and DCTF forbids hiding uncertainty about claims.
 */
export function ExecutiveBrief({ briefing }: { briefing: Briefing }) {
  const greeting = GREETINGS[briefing.kind];

  return (
    <Card className="bg-card border-intelligence-blue/20">
      <CardHeader className="flex-col items-stretch gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-caption text-muted-foreground">
            {greeting} &middot; prepared{' '}
            <time dateTime={briefing.generatedAt}>
              {formatRelativeTime(briefing.generatedAt)}
            </time>
          </p>
          <ConfidenceBadge confidence={briefing.confidence} />
        </div>

        {/*
          The headline is the single most important thing today, as one sentence.
          `text-balance` keeps it from breaking with one orphaned word.
        */}
        <h2 className="text-heading-s text-foreground font-semibold text-balance">
          {briefing.headline}
        </h2>
      </CardHeader>

      <CardContent>
        <p className="text-body text-muted-foreground leading-relaxed">
          {briefing.narrative}
        </p>
      </CardContent>
    </Card>
  );
}

const GREETINGS = {
  morning: 'Morning briefing',
  evening: 'Evening summary',
  weekly: 'Weekly review',
} as const;
