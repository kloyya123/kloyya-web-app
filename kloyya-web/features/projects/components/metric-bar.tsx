import { Progress } from '@/components/ui';

/**
 * A labelled progress meter — the shape both the board and the detail view use
 * for progress, risk, and health, so the three read identically wherever they
 * appear. `primary` leaves the Progress bar its default intelligence-blue.
 */
export function MetricBar({
  label,
  value,
  tone = 'primary',
}: {
  label: string;
  value: number;
  tone?: 'primary' | 'warning' | 'success';
}) {
  const bar =
    tone === 'warning'
      ? '[&>div]:bg-warning'
      : tone === 'success'
        ? '[&>div]:bg-success'
        : undefined;

  return (
    <div className="space-y-1.5">
      <div className="text-caption flex items-center justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground tabular-nums">{value}%</span>
      </div>
      <Progress value={value} label={`${label} ${value}%`} className={bar} />
    </div>
  );
}
