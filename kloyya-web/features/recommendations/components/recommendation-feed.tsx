'use client';

import { Lightbulb } from 'lucide-react';
import { RecommendationCard } from '@/components/ai';
import { useUrlState } from '@/hooks/use-url-state';
import {
  Card,
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingRegion,
  Skeleton,
} from '@/components/ui';
import { toErrorPresentation } from '@/lib/error-presentation';
import { partitionFeed, type PriorityFilter } from '@/lib/recommendation-feed';
import { useRecommendations, useRecordFeedback, useRecordOutcome } from '../hooks/use-recommendations';

const FILTERS: { value: PriorityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Critical', label: 'Critical' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
];

/**
 * The recommendation feed — the product's spine on its own surface.
 *
 * Everything the dashboard shows plus the Medium items it holds back, split into
 * what still needs deciding and what you've already decided. Each card is the
 * full RecommendationCard: evidence, reasoning, and the cost of ignoring it are
 * one expand away, and every card can be accepted, postponed, or dismissed.
 */
export function RecommendationFeed() {
  // In the URL, so a filtered feed is shareable and survives a refresh.
  const [filter, setFilter] = useUrlState<PriorityFilter>('priority', 'all');
  const { data, isPending, isError, error, refetch } = useRecommendations();

  const outcome = useRecordOutcome();
  const feedback = useRecordFeedback();

  const onOutcome = (id: string, o: Parameters<typeof outcome.mutate>[0]['outcome']) =>
    outcome.mutate({ id, outcome: o });
  const onRate = (id: string, rating: Parameters<typeof feedback.mutate>[0]['rating']) =>
    feedback.mutate({ id, rating });

  const feed = data ? partitionFeed(data, filter) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-heading-m text-foreground font-semibold">Recommendations</h1>
        <p className="text-small text-muted-foreground">
          Evidence-backed, ranked by decision score. Nothing here without a reason
          you can inspect.
        </p>
      </header>

      <div role="group" aria-label="Filter by priority" className="flex flex-wrap gap-2">
        {FILTERS.map(({ value, label }) => (
          <FilterChip key={value} active={filter === value} onClick={() => setFilter(value)}>
            {label}
          </FilterChip>
        ))}
      </div>

      {isPending ? (
        <LoadingRegion label="Loading recommendations" className="space-y-4">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </LoadingRegion>
      ) : isError ? (
        <Card>
          <ErrorState error={toErrorPresentation(error)} onRetry={() => void refetch()} />
        </Card>
      ) : feed && feed.active.length === 0 && feed.decided.length === 0 ? (
        <Card>
          <EmptyState
            icon={Lightbulb}
            title="Nothing to decide here."
            description="When Kloyya has an evidence-backed recommendation at this priority, it appears here."
          />
        </Card>
      ) : feed ? (
        <>
          {feed.active.length > 0 ? (
            <section aria-label="Needs a decision" className="space-y-4">
              <h2 className="text-title text-foreground font-semibold">Needs a decision</h2>
              <ul className="space-y-4">
                {feed.active.map((rec, index) => (
                  <li key={rec.id}>
                    <RecommendationCard
                      recommendation={rec}
                      onOutcome={onOutcome}
                      onRate={onRate}
                      defaultExpanded={index === 0}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {feed.decided.length > 0 ? (
            <section aria-label="Already decided" className="space-y-4">
              <h2 className="text-title text-foreground font-semibold">Already decided</h2>
              <ul className="space-y-4">
                {feed.decided.map((rec) => (
                  <li key={rec.id}>
                    <RecommendationCard
                      recommendation={rec}
                      onOutcome={onOutcome}
                      onRate={onRate}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
