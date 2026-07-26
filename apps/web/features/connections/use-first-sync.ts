'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { CONNECTIONS_KEY } from '@/hooks/use-integrations';
import { services } from '@/services';
import { isConnected, type IntegrationConnection } from '@/types/integrations';

/**
 * Run the first sync for anything freshly connected.
 *
 * Nothing used to. The OAuth callback stored tokens and redirected; no route,
 * no schedule and no component ever called the sync endpoint, so a user could
 * connect Gmail and it would hold zero messages indefinitely. The dashboard
 * being empty was the visible symptom of that.
 *
 * WHY THE CLIENT RUNS IT, rather than the callback.
 *
 * A first Gmail or Drive sync walks many pages and the route reserves 60
 * seconds for it. The callback cannot wait — it has to redirect the browser —
 * and firing a promise it does not await is unreliable on serverless, where the
 * function may be frozen the moment the response is sent. Without
 * `@vercel/functions`' waitUntil (not a dependency here), there is no safe
 * server-side "after the response" hook.
 *
 * The browser is a reliable caller at exactly the right moment: the user has
 * just finished connecting and is looking at the page. The request survives as
 * long as the tab does, and the existing poll in `useConnections` advances the
 * card from "Syncing…" to "Connected" on its own.
 *
 * WHAT THIS IS NOT. It is the FIRST sync, not a schedule. Keeping data fresh
 * afterwards needs a cron calling the same endpoint — see the note in the
 * connections README. This deliberately does not retry a failed sync in a loop:
 * a provider returning 403 would otherwise be hammered on every render.
 */
export function useFirstSync(connections: IntegrationConnection[] | undefined): void {
  const queryClient = useQueryClient();
  /**
   * Integrations this hook has already kicked off, so a re-render — or the
   * poll refetching while the sync is still running — cannot start a second.
   */
  const started = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!connections) return;

    const needsFirstSync = connections.filter(
      (connection) =>
        isConnected(connection) &&
        // 'connected' only. A connection still 'connecting', already 'syncing',
        // paused, or in error is not ours to start.
        connection.status === 'connected' &&
        connection.lastSyncedAt === null &&
        !started.current.has(connection.definition.id),
    );

    if (needsFirstSync.length === 0) return;

    for (const connection of needsFirstSync) {
      const id = connection.definition.id;
      started.current.add(id);

      void services.integrations
        .forceSync(id)
        .catch(() => {
          // Swallowed on purpose. The connection row records its own failure
          // and the card renders it — surfacing a toast here would report the
          // same problem twice, and this sync was never something the user
          // explicitly asked for.
        })
        .finally(() => {
          // Refresh the list either way: success updates lastSyncedAt, failure
          // updates the status, and both belong on screen.
          void queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
        });
    }
  }, [connections, queryClient]);
}
