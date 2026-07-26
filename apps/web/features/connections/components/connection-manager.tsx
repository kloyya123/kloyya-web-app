'use client';

import { PlugZap, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { toErrorPresentation } from '@/lib/error-presentation';
import { useConnections } from '@/hooks/use-integrations';
import { useFirstSync } from '../use-first-sync';
import { CATEGORY_LABELS } from '../integration-meta';
import {
  INTEGRATION_CATEGORIES,
  isConnected,
  type IntegrationCategory,
  type IntegrationConnection,
} from '@/types/integrations';
import { IntegrationCard } from './integration-card';

/**
 * The Connection Manager — the "Select Your Tools" surface.
 *
 * The spec's product argument is that breadth of connection is breadth of
 * intelligence, so the manager leads with how many sources are connected, then
 * lets the user browse the catalogue by category and connect more. Errored
 * connections are pulled to the top: a broken integration is the thing most
 * worth the user's attention.
 */
export function ConnectionManager() {
  const { data, isPending, isError, error, refetch } = useConnections();

  // Anything just connected has never synced; start it now. Nothing else in
  // the app does, so without this a connected tool stays empty. See use-first-sync.
  useFirstSync(data);
  const [activeCategory, setActiveCategory] = useState<IntegrationCategory | 'all'>('all');

  const grouped = useMemo(() => groupByCategory(data ?? []), [data]);
  const stats = useMemo(() => summarize(data ?? []), [data]);

  if (isPending) return <ConnectionManagerSkeleton />;

  if (isError) {
    return (
      <Card>
        <ErrorState error={toErrorPresentation(error)} onRetry={() => void refetch()} />
      </Card>
    );
  }

  const visibleCategories =
    activeCategory === 'all' ? INTEGRATION_CATEGORIES : [activeCategory];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-heading-m text-foreground font-semibold">Connect your tools</h1>
        <p className="text-small text-muted-foreground">
          Every connected app is another piece of organizational intelligence. Kloyya
          reads only what you approve, and never edits or shares your data.
        </p>
      </header>

      <SummaryBar connected={stats.connected} total={stats.total} attention={stats.attention} />

      <CategoryFilter active={activeCategory} onChange={setActiveCategory} counts={stats.byCategory} />

      <div className="space-y-8">
        {visibleCategories.map((category) => {
          const items = grouped.get(category) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={category} aria-labelledby={`cat-${category}`}>
              <h2
                id={`cat-${category}`}
                className="text-title text-foreground mb-3 font-semibold"
              >
                {CATEGORY_LABELS[category]}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((connection) => (
                  <IntegrationCard key={connection.definition.id} connection={connection} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SummaryBar({
  connected,
  total,
  attention,
}: {
  connected: number;
  total: number;
  attention: number;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-6">
        <Stat icon={<PlugZap aria-hidden="true" className="text-link size-5" />}
          value={`${connected} of ${total}`} label="Sources connected" />
        {attention > 0 ? (
          <Stat
            icon={<TriangleAlert aria-hidden="true" className="text-caution size-5" />}
            value={String(attention)}
            label="Need attention"
          />
        ) : null}
        <p className="text-caption text-subtle max-w-sm">
          More connected sources mean richer context, better recommendations, and
          higher confidence in every briefing.
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <p className="text-title text-foreground font-semibold tabular-nums">{value}</p>
        <p className="text-caption text-subtle">{label}</p>
      </div>
    </div>
  );
}

function CategoryFilter({
  active,
  onChange,
  counts,
}: {
  active: IntegrationCategory | 'all';
  onChange: (category: IntegrationCategory | 'all') => void;
  counts: Map<IntegrationCategory, number>;
}) {
  const options: Array<{ value: IntegrationCategory | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    ...INTEGRATION_CATEGORIES.filter((category) => (counts.get(category) ?? 0) > 0).map(
      (category) => ({ value: category, label: CATEGORY_LABELS[category] }),
    ),
  ];

  return (
    <div
      role="tablist"
      aria-label="Filter integrations by category"
      className="flex flex-wrap gap-2"
    >
      {options.map((option) => {
        const isActive = active === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'text-small rounded-full border px-3 py-1 font-medium transition-colors',
              isActive
                ? 'border-intelligence-blue bg-intelligence-blue/12 text-link'
                : 'border-border text-muted-foreground hover:bg-hover hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function groupByCategory(
  connections: IntegrationConnection[],
): Map<IntegrationCategory, IntegrationConnection[]> {
  const grouped = new Map<IntegrationCategory, IntegrationConnection[]>();
  for (const connection of connections) {
    const category = connection.definition.category;
    const list = grouped.get(category) ?? [];
    // Connected first within a category, so the user sees what they have before
    // what they could add.
    list.push(connection);
    grouped.set(category, list);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => Number(isConnected(b)) - Number(isConnected(a)));
  }
  return grouped;
}

function summarize(connections: IntegrationConnection[]) {
  const byCategory = new Map<IntegrationCategory, number>();
  for (const connection of connections) {
    byCategory.set(
      connection.definition.category,
      (byCategory.get(connection.definition.category) ?? 0) + 1,
    );
  }
  return {
    connected: connections.filter(isConnected).length,
    total: connections.length,
    attention: connections.filter((c) => c.status === 'error').length,
    byCategory,
  };
}

function ConnectionManagerSkeleton() {
  return (
    <LoadingRegion label="Loading your connected tools" className="space-y-6">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-lg" />
        ))}
      </div>
    </LoadingRegion>
  );
}
