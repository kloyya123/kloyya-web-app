import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from './card';

/** Whether a movement is good, bad, or neither. Never inferred from the sign. */
export type TrendSentiment = 'positive' | 'negative' | 'neutral';

export interface KpiTrend {
  /** Signed percentage change against `comparisonLabel`. */
  deltaPercent: number;
  /** What the delta is measured against, e.g. "vs last week". */
  comparisonLabel: string;
  /**
   * Explicit, because direction does not imply sentiment. Open risks rising is
   * bad; tasks completed rising is good. Inferring from the sign gets one of
   * those wrong every time.
   */
  sentiment: TrendSentiment;
}

export interface KpiCardProps {
  label: string;
  value: string;
  /**
   * Required. KDS: "Every KPI should explain itself."
   * A number with no explanation is a number the user must interpret alone,
   * which is exactly the cognitive load Kloyya exists to remove.
   */
  explanation: string;
  icon?: LucideIcon;
  trend?: KpiTrend;
  className?: string;
}

const trendStyles: Record<TrendSentiment, string> = {
  positive: 'text-positive',
  negative: 'text-critical',
  neutral: 'text-muted-foreground',
};

const trendIcons: Record<TrendSentiment, LucideIcon> = {
  positive: ArrowUpRight,
  negative: ArrowDownRight,
  neutral: ArrowRight,
};

export function KpiCard({
  label,
  value,
  explanation,
  icon: Icon,
  trend,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-small text-muted-foreground font-medium">{label}</p>
        {Icon ? (
          <Icon aria-hidden="true" className="text-subtle size-4 shrink-0" />
        ) : null}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-heading-s text-foreground font-semibold tabular-nums">
          {value}
        </p>

        {trend ? <TrendIndicator trend={trend} /> : null}
      </div>

      <p className="text-caption text-muted-foreground mt-2 text-balance">
        {explanation}
      </p>
    </Card>
  );
}

function TrendIndicator({ trend }: { trend: KpiTrend }) {
  const Icon = trendIcons[trend.sentiment];
  const sign = trend.deltaPercent > 0 ? '+' : '';
  const magnitude = `${sign}${trend.deltaPercent.toFixed(1)}%`;

  return (
    <span
      className={cn(
        'text-caption inline-flex items-center gap-0.5 font-medium tabular-nums',
        trendStyles[trend.sentiment],
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {/*
        Sighted users read the arrow and the sign. Screen readers get the full
        sentence, because "+12.4%" alone omits what it is compared against.
      */}
      <span aria-hidden="true">{magnitude}</span>
      <span className="sr-only">
        {magnitude} {trend.comparisonLabel}
      </span>
    </span>
  );
}
