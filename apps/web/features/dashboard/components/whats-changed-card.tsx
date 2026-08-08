'use client';

import { ArrowRight, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { SOURCE_ICON } from '@/components/ai';
import { Button, Card, EmptyState } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import type { EvidenceSourceType, Recommendation, RiskLevel } from '@/types/domain';

const RISK_BORDER: Record<RiskLevel, string> = {
  Critical: 'border-l-danger',
  High: 'border-l-danger',
  Medium: 'border-l-warning',
  Low: 'border-l-border',
};

/**
 * The dashboard's lead feed — what Kloyya thinks you should know about, before
 * you have to ask. Sourced from `data.recommendations`: the same evidence-backed
 * objects the full feed at /recommendations renders, just the top three, still
 * pending a decision. Nothing here is a fabricated "change log" — every card is
 * a real recommendation with real evidence attached to it.
 */
export function WhatsChangedCard({ recommendations }: { recommendations: Recommendation[] }) {
  const pending = recommendations.filter((rec) => rec.outcome === 'pending').slice(0, 3);

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-1">
        <h2 className="text-title text-foreground font-semibold">What&rsquo;s changed</h2>
        <Link
          href="/recommendations"
          className="text-caption text-link inline-flex items-center gap-1 rounded-sm hover:underline"
        >
          View all
          <ArrowRight aria-hidden="true" className="size-3" />
        </Link>
      </div>

      {pending.length === 0 ? (
        <div className="px-6 pb-5">
          <EmptyState
            icon={Lightbulb}
            title="Nothing needs a decision right now."
            description="When Kloyya has an evidence-backed recommendation, it appears here first."
          />
        </div>
      ) : (
        <ul className="divide-border divide-y">
          {pending.map((rec) => (
            <li key={rec.id} className={cn('border-l-2 px-6 py-4', RISK_BORDER[rec.risk])}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-caption text-subtle font-medium tracking-wide uppercase">
                    {rec.priority} priority
                  </p>
                  <p className="text-body text-foreground font-semibold text-balance">{rec.title}</p>
                  <p className="text-small text-muted-foreground">{rec.reason}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {dedupeSources(rec).map(({ type, label }) => {
                      const Icon = SOURCE_ICON[type];
                      return (
                        <span
                          key={type}
                          className="border-border text-caption text-subtle inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
                        >
                          <Icon aria-hidden="true" className="size-3" />
                          {label}
                        </span>
                      );
                    })}
                    <span className="text-caption text-subtle">
                      {formatRelativeTime(rec.createdAt)}
                    </span>
                  </div>
                </div>

                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href="/recommendations">Review</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** One chip per distinct source type cited as evidence, first label wins. */
function dedupeSources(rec: Recommendation): { type: EvidenceSourceType; label: string }[] {
  const seen = new Map<EvidenceSourceType, string>();
  for (const item of rec.evidence) {
    if (!seen.has(item.sourceType)) seen.set(item.sourceType, item.sourceLabel);
  }
  return [...seen.entries()].map(([type, label]) => ({ type, label }));
}
