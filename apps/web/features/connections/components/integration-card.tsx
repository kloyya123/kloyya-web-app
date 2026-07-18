'use client';

import { MoreVertical, Pause, Play, Plug, RefreshCw, RotateCw, Unplug } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from '@/components/ui';
import { toErrorPresentation } from '@/lib/error-presentation';
import { formatRelativeTime } from '@/lib/format';
import { useConnectionAction, type ConnectionAction } from '@/hooks/use-integrations';
import type { IntegrationConnection } from '@/types/integrations';
import { CONNECTION_STATUS_META, integrationIcon, SYNC_STAGES } from '../integration-meta';
import { ConnectDialog } from './connect-dialog';

/**
 * One catalogue card.
 *
 * Not connected → a single Connect button that opens the permission-review
 * dialog. Connected → the status, last sync time, and a menu of management
 * actions (sync, pause/resume, disconnect). Errored → a prominent Reconnect,
 * because a broken integration is the thing the user most needs to fix.
 */
export function IntegrationCard({ connection }: { connection: IntegrationConnection }) {
  const { definition, status } = connection;
  const meta = CONNECTION_STATUS_META[status];
  const Icon = integrationIcon(definition.id, definition.category);

  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const action = useConnectionAction();

  function run(next: ConnectionAction, successMessage: string) {
    action.mutate(
      { action: next, id: definition.id },
      {
        onSuccess: () => toast.success(successMessage),
        onError: (error) => toast.error(toErrorPresentation(error).title),
      },
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className="bg-hover text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
          <Icon aria-hidden="true" className="size-4.5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-small text-foreground font-semibold">{definition.name}</h3>
            <Badge tone={meta.tone} withDot={meta.isConnected}>
              {meta.label}
            </Badge>
          </div>
          <p className="text-caption text-muted-foreground mt-1 line-clamp-2">
            {definition.description}
          </p>
        </div>
      </div>

      {status === 'syncing' || status === 'connecting' ? <SyncingIndicator /> : null}

      {status === 'error' && connection.errorReason ? (
        <p className="text-caption text-critical border-danger/30 bg-danger/10 rounded-sm border px-2.5 py-1.5">
          {connection.errorReason}
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-caption text-subtle">
          {connection.lastSyncedAt ? (
            <>
              Synced{' '}
              <time dateTime={connection.lastSyncedAt}>
                {formatRelativeTime(connection.lastSyncedAt)}
              </time>
            </>
          ) : definition.estimatedSyncMinutes > 0 ? (
            `~${definition.estimatedSyncMinutes} min first sync`
          ) : (
            'Custom endpoint'
          )}
        </span>

        <IntegrationActions
          connection={connection}
          isBusy={action.isPending}
          onConnect={() => setIsConnectOpen(true)}
          onRun={run}
        />
      </div>

      <ConnectDialog
        connection={connection}
        isOpen={isConnectOpen}
        onOpenChange={setIsConnectOpen}
      />
    </Card>
  );
}

/**
 * The syncing animation shown while a tool connects and pulls its first data.
 *
 * A spinning icon, an animated progress shimmer, and the current sync stage
 * cycling through — so "Syncing" is something a user watches happen, not a static
 * label. Reduced motion stills the spin and shimmer (motion-reduce), leaving the
 * stage text, which still tells the truth about what's happening.
 */
function SyncingIndicator() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStage((s) => (s + 1) % SYNC_STAGES.length);
    }, 700);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-1.5" role="status" aria-live="polite">
      <p className="text-caption text-info flex items-center gap-1.5">
        <RefreshCw aria-hidden="true" className="size-3 animate-spin motion-reduce:animate-none" />
        {SYNC_STAGES[stage]}…
      </p>
      <div className="bg-hover h-1 overflow-hidden rounded-full">
        <div className="bg-info/70 h-full w-1/3 animate-pulse rounded-full motion-reduce:animate-none" />
      </div>
    </div>
  );
}

function IntegrationActions({
  connection,
  isBusy,
  onConnect,
  onRun,
}: {
  connection: IntegrationConnection;
  isBusy: boolean;
  onConnect: () => void;
  onRun: (action: ConnectionAction, message: string) => void;
}) {
  const { definition, status } = connection;
  const name = definition.name;

  if (status === 'not_connected') {
    return (
      <Button size="sm" onClick={onConnect} leadingIcon={<Plug aria-hidden="true" />}>
        Connect
      </Button>
    );
  }

  if (status === 'error') {
    return (
      <Button
        size="sm"
        variant="secondary"
        isLoading={isBusy}
        loadingLabel={`Reconnecting ${name}`}
        onClick={() => onRun('reconnect', `${name} reconnected.`)}
        leadingIcon={<RotateCw aria-hidden="true" />}
      >
        Reconnect
      </Button>
    );
  }

  const isPaused = status === 'paused';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" isLoading={isBusy} loadingLabel="Working">
          <MoreVertical aria-hidden="true" />
          <span className="sr-only">Manage {name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onRun('forceSync', `Syncing ${name}.`)}>
          <RefreshCw aria-hidden="true" />
          Sync now
        </DropdownMenuItem>

        {isPaused ? (
          <DropdownMenuItem onSelect={() => onRun('resume', `${name} resumed.`)}>
            <Play aria-hidden="true" />
            Resume syncing
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onRun('pause', `${name} paused.`)}>
            <Pause aria-hidden="true" />
            Pause syncing
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          isDestructive
          onSelect={() => onRun('disconnect', `${name} disconnected.`)}
        >
          <Unplug aria-hidden="true" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
