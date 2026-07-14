'use client';

import { Check, X } from 'lucide-react';
import { Progress, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { providerIcon } from '@/components/sources/source-meta';
import { useKnowledgeCoverage, useSourceUsage } from '@/hooks/use-sources';
import { presentConfidence } from '@/lib/confidence';

/**
 * The retrieval story behind a recommendation.
 *
 * The spec's #4 (Source Inclusion & Exclusion Reasoning) and #8 (Knowledge
 * Coverage Indicator), together: which sources were used, which were not and
 * why, and how complete the picture was.
 *
 * Data is fetched only when `enabled` — i.e. only once the user has expanded the
 * card. There is no reason to compute retrieval reasoning for a recommendation
 * nobody asked about.
 */
export function RetrievalTransparency({
  recommendationId,
  enabled,
}: {
  recommendationId: string;
  enabled: boolean;
}) {
  const usage = useSourceUsage(recommendationId, enabled);
  const coverage = useKnowledgeCoverage(recommendationId, enabled);

  if (usage.isPending || coverage.isPending) {
    return <Skeleton className="h-24 w-full rounded-sm" />;
  }

  // A failure here is not worth an alarm — the recommendation is still complete
  // without its retrieval breakdown. Fail quiet.
  if (usage.isError || coverage.isError || !usage.data || !coverage.data) {
    return null;
  }

  const included = usage.data.filter((entry) => entry.included);
  const excluded = usage.data.filter((entry) => !entry.included);
  const coverageBand = presentConfidence(coverage.data.coverage);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h4 className="text-caption text-muted-foreground font-medium tracking-wide uppercase">
            Knowledge coverage
          </h4>
          <span className="text-small text-foreground font-medium tabular-nums">
            {coverage.data.coverage}%
          </span>
        </div>
        <Progress
          value={coverage.data.coverage}
          label={`Knowledge coverage ${coverage.data.coverage} percent`}
        />
        {coverage.data.missingProviders.length > 0 ? (
          <p className="text-caption text-subtle mt-1.5">
            {coverageBand.band === 'high'
              ? 'Well covered.'
              : 'Connecting these would improve results: '}
            {coverage.data.missingProviders
              .map((provider) => providerLabel(provider))
              .join(', ')}
            .
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SourceList title="Searched" tone="included" entries={included} />
        <SourceList title="Not used" tone="excluded" entries={excluded} />
      </div>
    </div>
  );
}

interface UsageEntry {
  sourceId: string;
  provider: Parameters<typeof providerIcon>[0];
  displayName: string;
  reason: string;
}

function SourceList({
  title,
  tone,
  entries,
}: {
  title: string;
  tone: 'included' | 'excluded';
  entries: UsageEntry[];
}) {
  if (entries.length === 0) return null;

  const Marker = tone === 'included' ? Check : X;

  return (
    <div>
      <h5 className="text-caption text-subtle mb-2 font-medium">
        {title} ({entries.length})
      </h5>
      <ul className="space-y-2">
        {entries.map((entry) => {
          const Icon = providerIcon(entry.provider);
          return (
            <li key={entry.sourceId} className="flex items-start gap-2">
              <Marker
                aria-hidden="true"
                className={cn(
                  'mt-0.5 size-3.5 shrink-0',
                  tone === 'included' ? 'text-positive' : 'text-subtle',
                )}
              />
              <div className="min-w-0">
                <span className="text-caption text-foreground flex items-center gap-1.5 font-medium">
                  <Icon aria-hidden="true" className="size-3" />
                  {entry.displayName}
                </span>
                <span className="text-caption text-subtle">{entry.reason}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Human label for a provider used in prose. */
function providerLabel(provider: string): string {
  return provider
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
