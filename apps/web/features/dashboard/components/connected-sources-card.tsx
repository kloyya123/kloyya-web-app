'use client';

import { ArrowRight, Plug } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { hasBrandLogo, IntegrationBrandLogo } from '@/components/brand/integration-logos';
import { useConnectionSummary } from '@/hooks/use-integrations';
import { integrationIcon, CONNECTION_STATUS_META } from '@/features/connections/integration-meta';
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
      title="Connected tools"
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
          <ul className="space-y-3">
            {data.preview.map((connection) => {
              const { id, category, name } = connection.definition;
              const Icon = integrationIcon(id, category);
              const meta = CONNECTION_STATUS_META[connection.status];
              return (
                <li key={id} className="flex items-center gap-2.5">
                  {hasBrandLogo(id) ? (
                    <IntegrationBrandLogo id={id} className="size-4 shrink-0" />
                  ) : (
                    <Icon aria-hidden="true" className="text-subtle size-4 shrink-0" />
                  )}
                  <span className="text-small text-foreground min-w-0 flex-1 truncate">
                    {name}
                  </span>
                  <span
                    className={cn(
                      'text-caption shrink-0 font-medium',
                      connection.status === 'error'
                        ? 'text-critical'
                        : connection.status === 'paused'
                          ? 'text-muted-foreground'
                          : 'text-positive',
                    )}
                  >
                    {meta.label}
                  </span>
                </li>
              );
            })}
          </ul>

          {data.connected > data.preview.length ? (
            <Link
              href="/connections"
              className="text-caption text-subtle hover:text-foreground block text-center"
            >
              +{data.connected - data.preview.length} more tools
            </Link>
          ) : null}
        </div>
      )}
    </SidebarCard>
  );
}
