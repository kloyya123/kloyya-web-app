'use client';

import { CheckCircle2, CircleSlash, Clock3, Pencil, type LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { formatRelativeTime } from '@/lib/format';
import type { Recommendation, RecommendationOutcome } from '@/types/domain';
import { SidebarCard } from './dashboard';

const OUTCOME_ICON: Record<Exclude<RecommendationOutcome, 'pending'>, LucideIcon> = {
  accepted: CheckCircle2,
  completed: CheckCircle2,
  dismissed: CircleSlash,
  postponed: Clock3,
  edited: Pencil,
  ignored: CircleSlash,
};

const OUTCOME_LABEL: Record<Exclude<RecommendationOutcome, 'pending'>, string> = {
  accepted: 'Accepted',
  completed: 'Completed',
  dismissed: 'Dismissed',
  postponed: 'Postponed',
  edited: 'Edited',
  ignored: 'Ignored',
};

/**
 * What you've already decided — real outcomes recorded against real
 * recommendations, not a fabricated decision log. A recommendation only lands
 * here once its `outcome` moves off `pending`, via the same accept/dismiss/
 * postpone actions available on the full feed.
 */
export function RecentDecisionsCard({ recommendations }: { recommendations: Recommendation[] }) {
  const decided = recommendations
    .filter((rec) => rec.outcome !== 'pending')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);

  return (
    <SidebarCard title="Recent decisions">
      {decided.length === 0 ? (
        <EmptyState
          icon={Clock3}
          title="No decisions yet."
          description="Accept, dismiss, or postpone a recommendation and it shows up here."
        />
      ) : (
        <ul className="space-y-3">
          {decided.map((rec) => {
            const outcome = rec.outcome as Exclude<RecommendationOutcome, 'pending'>;
            const Icon = OUTCOME_ICON[outcome];
            return (
              <li key={rec.id} className="flex items-start gap-2.5">
                <Icon aria-hidden="true" className="text-subtle mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-small text-foreground truncate font-medium">{rec.title}</p>
                  <p className="text-caption text-subtle">
                    {OUTCOME_LABEL[outcome]} &middot; {formatRelativeTime(rec.updatedAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SidebarCard>
  );
}
