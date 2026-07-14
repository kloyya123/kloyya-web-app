'use client';

import { useEffect, useState } from 'react';
import { IntelligenceTimeline } from '@/components/intelligence/intelligence-timeline';
import { CATEGORY_LABEL } from '@/components/sources/source-meta';
import { SourceCard } from '@/components/sources/source-card';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  KpiCard,
  LoadingRegion,
  Skeleton,
} from '@/components/ui';
import { toErrorPresentation } from '@/lib/error-presentation';
import {
  advancePipeline,
  initialPipeline,
  isPipelineComplete,
} from '@/lib/intelligence-pipeline';
import { useIntelligenceHealth, useSources } from '@/hooks/use-sources';
import { SOURCE_CATEGORIES, type ConnectedSource, type PipelineStage } from '@/types/sources';

/**
 * The AI Trust Center.
 *
 * The spec's #10: "a dedicated page where users can inspect connected data
 * sources, permissions, sync status, AI confidence trends… the control center
 * for understanding how Kloyya operates."
 *
 * It answers the product's promise made concrete — users see the whole
 * lifecycle: which sources feed Kloyya, how healthy they are, and how a single
 * request moves through the reasoning pipeline.
 */
export function TrustCenter() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-heading-m text-foreground font-semibold">Trust Center</h1>
        <p className="text-small text-muted-foreground">
          Where Kloyya&rsquo;s intelligence comes from, and how it reaches a decision.
        </p>
      </header>

      <HealthSection />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <SourceNetwork />
        </div>
        <div>
          <ReasoningSample />
        </div>
      </div>
    </div>
  );
}

function HealthSection() {
  const { data: health, isPending, isError, error, refetch } = useIntelligenceHealth();

  if (isPending) {
    return (
      <LoadingRegion label="Loading intelligence health" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </LoadingRegion>
    );
  }

  if (isError) {
    return (
      <Card>
        <ErrorState error={toErrorPresentation(error)} onRetry={() => void refetch()} />
      </Card>
    );
  }

  return (
    <section aria-label="Intelligence health" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Connected sources"
        value={String(health.totalSources)}
        explanation={`${health.healthy} healthy, ${health.needsAttention} need attention.`}
      />
      <KpiCard
        label="Knowledge coverage"
        value={`${health.knowledgeCoverage}%`}
        explanation="How much of your connected network is usable right now."
      />
      <KpiCard
        label="Average freshness"
        value={`${health.averageFreshnessMinutes} min`}
        explanation="How recently working sources last synced, on average."
      />
      <KpiCard
        label="Recommendation confidence"
        value={`${health.recommendationConfidence}%`}
        explanation="Average confidence across today's recommendations."
      />
    </section>
  );
}

function SourceNetwork() {
  const { data: sources, isPending, isError, error, refetch } = useSources();

  if (isPending) {
    return (
      <LoadingRegion label="Loading connected sources" className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-md" />
        ))}
      </LoadingRegion>
    );
  }

  if (isError) {
    return (
      <Card>
        <ErrorState error={toErrorPresentation(error)} onRetry={() => void refetch()} />
      </Card>
    );
  }

  const byCategory = new Map<string, ConnectedSource[]>();
  for (const source of sources) {
    const list = byCategory.get(source.category) ?? [];
    list.push(source);
    byCategory.set(source.category, list);
  }

  return (
    <div className="space-y-6">
      {SOURCE_CATEGORIES.map((category) => {
        const list = byCategory.get(category);
        if (!list || list.length === 0) return null;

        return (
          <section key={category} aria-label={CATEGORY_LABEL[category]}>
            <h2 className="text-caption text-subtle mb-3 font-medium tracking-wide uppercase">
              {CATEGORY_LABEL[category]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * A worked example of one intelligence run, so the page shows *how* Kloyya
 * reasons, not only what it connects to. Loops gently so it always demonstrates.
 */
function ReasoningSample() {
  const [stages, setStages] = useState<PipelineStage[]>(() => initialPipeline());

  useEffect(() => {
    const interval = setInterval(() => {
      setStages((current) =>
        isPipelineComplete(current) ? initialPipeline() : advancePipeline(current),
      );
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>How a request flows</CardTitle>
      </CardHeader>
      <CardContent>
        <IntelligenceTimeline stages={stages} />
      </CardContent>
    </Card>
  );
}
