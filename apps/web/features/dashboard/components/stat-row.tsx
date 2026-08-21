import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface Stat {
  icon: LucideIcon;
  tone: 'critical' | 'warning' | 'info' | 'positive';
  value: number;
  label: string;
}

const TONE_STYLES: Record<Stat['tone'], string> = {
  critical: 'bg-danger/12 text-critical',
  warning: 'bg-warning/12 text-caution',
  info: 'bg-info/12 text-notice',
  positive: 'bg-success/12 text-positive',
};

/**
 * Three real counts, at a glance — every number here comes straight off
 * `DashboardData.metrics` and the pending recommendation count. No invented
 * "things changed since yesterday" delta: Kloyya doesn't track that yet, so
 * this doesn't claim to.
 */
export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <Card className="divide-border flex flex-col divide-y p-0 sm:flex-row sm:divide-x sm:divide-y-0">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-1 items-center gap-4 p-5">
          <span
            className={cn(
              'inline-flex size-11 shrink-0 items-center justify-center rounded-full',
              TONE_STYLES[stat.tone],
            )}
          >
            <stat.icon aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-heading-s text-foreground font-semibold tabular-nums">{stat.value}</p>
            <p className="text-caption text-muted-foreground">{stat.label}</p>
          </div>
        </div>
      ))}
    </Card>
  );
}
