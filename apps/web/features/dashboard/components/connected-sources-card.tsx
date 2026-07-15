'use client';

import { ArrowRight, Check, Plug, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { Badge, EmptyState, Skeleton } from '@/components/ui';
import { useConnectionSummary } from '@/hooks/use-integrations';
import { integrationIcon } from '@/features/connections/integration-meta';
import { SidebarCard } from './dashboard';

/**
 * The dashboard's Connected Sources widget.
 *
 * The spec: show the connected apps with a "+N more", and clicking opens the
 * Connection Manager. It doubles as a nudge — the product's argument is that
 * more connected sources mean better intelligence, so a low count is worth
 * surfacing, gently.
 */
export function ConnectedSourcesCard() {
  const { data, isPending } = useConnectionSummary();

  return (
    <SidebarCard
      title="Connected sources"
      action={
        <Link
          href="/connections"
          className="text-caption text-link inline-flex items-center gap-1 rounded-sm hover:underline"
        >
          Manage
          <ArrowRight aria-hidden="true" className="size-3" />
        </Link>
      }
    >
      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-6 w-full" />
          ))}
        </div>
      ) : !data || data.connected === 0 ? (
        <EmptyState
          icon={Plug}
          title="No tools connected yet."
          description="Connect Gmail or your calendar, and Kloyya starts understanding your work."
          action={
            <Link
              href="/connections"
              className="text-small text-link rounded-sm font-medium hover:underline"
            >
              Connect your first tool
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-small text-foreground">
              <span className="font-semibold tabular-nums">{data.connected}</span> of{' '}
              <span className="tabular-nums">{data.total}</span> connected
            </p>
            {data.needsAttention > 0 ? (
              <Badge tone="warning">
                <TriangleAlert aria-hidden="true" className="size-3" />
                {data.needsAttention} need attention
              </Badge>
            ) : null}
          </div>

          <ul className="space-y-1.5">
            {data.preview.map((connection) => {
              const Icon = integrationIcon(
                connection.definition.id,
                connection.definition.category,
              );
              return (
                <li
                  key={connection.definition.id}
                  className="text-small text-muted-foreground flex items-center gap-2"
                >
                  <Icon aria-hidden="true" className="text-subtle size-3.5 shrink-0" />
                  <span className="flex-1 truncate">{connection.definition.name}</span>
                  <Check aria-hidden="true" className="text-positive size-3.5 shrink-0" />
                </li>
              );
            })}
          </ul>

          {data.connected > data.preview.length ? (
            <Link
              href="/connections"
              className="text-caption text-link inline-block rounded-sm hover:underline"
            >
              +{data.connected - data.preview.length} more
            </Link>
          ) : null}
        </div>
      )}
    </SidebarCard>
  );
}
