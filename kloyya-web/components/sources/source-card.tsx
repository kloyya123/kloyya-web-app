'use client';

import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import type { ConnectedSource } from '@/types/sources';
import { PERMISSION_LABEL, STATUS_META, providerIcon } from './source-meta';

/**
 * One connected source, with everything the spec's "Source Confidence &
 * Freshness" panel wants: confidence, last-updated, permission, status, and how
 * many recommendations lean on it.
 *
 * A source that needs attention says why, and says it in the interface's voice —
 * "Access token expired. Re-authorize…", not an error code.
 */
export function SourceCard({ source }: { source: ConnectedSource }) {
  const Icon = providerIcon(source.provider);
  const status = STATUS_META[source.status];

  return (
    <div
      className={cn(
        'bg-card border-border rounded-md border p-4',
        !status.isWorking && 'border-warning/40',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-surface text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
            <Icon aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-small text-foreground truncate font-medium">
              {source.displayName}
            </p>
            <p className="text-caption text-subtle">
              {PERMISSION_LABEL[source.permission]}
            </p>
          </div>
        </div>

        <Badge tone={status.tone} withDot>
          {status.label}
        </Badge>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        <Metric label="Confidence" value={`${source.confidence}%`} />
        <Metric label="Freshness" value={`${source.freshness}%`} />
        <Metric
          label="Last sync"
          value={<time dateTime={source.lastSyncedAt}>{formatRelativeTime(source.lastSyncedAt)}</time>}
        />
        <Metric
          label="Referenced by"
          value={
            source.referencedByCount === 1
              ? '1 recommendation'
              : `${source.referencedByCount} recommendations`
          }
        />
      </dl>

      {source.attentionReason ? (
        <div className="border-warning/30 bg-warning/10 mt-3 flex items-start gap-2 rounded-sm border px-3 py-2">
          <AlertTriangle aria-hidden="true" className="text-caution mt-0.5 size-3.5 shrink-0" />
          <p className="text-caption text-muted-foreground">{source.attentionReason}</p>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-caption text-subtle">{label}</dt>
      <dd className="text-small text-foreground tabular-nums">{value}</dd>
    </div>
  );
}
