import {
  INITIALLY_CONNECTED,
  INTEGRATION_CATALOG,
} from '@/mock/integrations';
import { API_STATUS } from '@/types/api';
import type {
  ConnectionStatus,
  IntegrationCategory,
  IntegrationConnection,
} from '@/types/integrations';
import { mockError, mockRespond } from '../http/mock-transport';
import type { ConnectionSummary, IntegrationsService } from './types';

/**
 * Mock Connection Manager.
 *
 * Holds connection state in a Map, mutated by the lifecycle actions so a connect
 * or disconnect persists for the session exactly as a real backend would. The
 * state machine — which transitions are legal from which status — is the part
 * that matters, and it moves to the server unchanged.
 */

const NON_WORKING: ReadonlySet<ConnectionStatus> = new Set<ConnectionStatus>([
  'not_connected',
]);

function initialState(): Map<string, IntegrationConnection> {
  const now = Date.now();
  const seeded = new Map(INITIALLY_CONNECTED.map((entry) => [entry.id, entry]));

  return new Map(
    INTEGRATION_CATALOG.map((definition) => {
      const connected = seeded.get(definition.id);

      if (!connected) {
        return [
          definition.id,
          { definition, status: 'not_connected', lastSyncedAt: null },
        ];
      }

      const lastSyncedAt = new Date(
        now - connected.minutesSinceSync * 60_000,
      ).toISOString();

      const connection: IntegrationConnection = connected.error
        ? { definition, status: 'error', lastSyncedAt, errorReason: connected.error }
        : { definition, status: 'connected', lastSyncedAt };

      return [definition.id, connection];
    }),
  );
}

export class MockIntegrationsService implements IntegrationsService {
  private readonly connections = initialState();

  async listConnections(
    category?: IntegrationCategory,
  ): Promise<IntegrationConnection[]> {
    const all = [...this.connections.values()];
    const scoped = category
      ? all.filter((c) => c.definition.category === category)
      : all;
    const { data } = await mockRespond(scoped);
    return data;
  }

  async getConnection(id: string): Promise<IntegrationConnection> {
    const connection = this.require(id);
    const { data } = await mockRespond(connection);
    return data;
  }

  async connect(id: string): Promise<IntegrationConnection> {
    const connection = this.require(id);
    if (connection.status !== 'not_connected') {
      mockError(
        API_STATUS.Conflict,
        'already_connected',
        `${connection.definition.name} is already connected.`,
        'This integration is connected already.',
        'Disconnect it first if you want to reconnect.',
      );
    }
    // Connecting isn't instant — it lands in `syncing` and pulls the first data in
    // the background, exactly as the real OAuth-then-sync flow does. The card shows
    // the syncing animation until this internal timer flips it to `connected`.
    const result = this.transition(id, { status: 'syncing', lastSyncedAt: null });
    setTimeout(() => {
      const current = this.connections.get(id);
      // Only advance if it's still syncing — a disconnect mid-sync must win.
      if (current?.status === 'syncing') {
        this.connections.set(id, { ...current, status: 'connected', lastSyncedAt: now() });
      }
    }, 2600);
    return result;
  }

  async disconnect(id: string): Promise<IntegrationConnection> {
    const connection = this.require(id);
    if (connection.status === 'not_connected') {
      mockError(
        API_STATUS.Conflict,
        'not_connected',
        `${connection.definition.name} is not connected.`,
        'There is nothing to disconnect.',
        'Connect it first.',
      );
    }
    return this.transition(id, { status: 'not_connected', lastSyncedAt: null });
  }

  async pause(id: string): Promise<IntegrationConnection> {
    const connection = this.require(id);
    if (connection.status !== 'connected') {
      mockError(
        API_STATUS.Conflict,
        'cannot_pause',
        `${connection.definition.name} cannot be paused.`,
        'Only a healthy, connected integration can be paused.',
        'Reconnect it first if it needs attention.',
      );
    }
    return this.transition(id, { status: 'paused' });
  }

  async resume(id: string): Promise<IntegrationConnection> {
    const connection = this.require(id);
    if (connection.status !== 'paused') {
      mockError(
        API_STATUS.Conflict,
        'not_paused',
        `${connection.definition.name} is not paused.`,
        'Only a paused integration can be resumed.',
        'No action is needed.',
      );
    }
    return this.transition(id, { status: 'connected', lastSyncedAt: now() });
  }

  async reconnect(id: string): Promise<IntegrationConnection> {
    const connection = this.require(id);
    if (connection.status !== 'error') {
      mockError(
        API_STATUS.Conflict,
        'nothing_to_recover',
        `${connection.definition.name} does not need reconnecting.`,
        'Reconnect only applies to an integration in an error state.',
        'No action is needed.',
      );
    }
    // Clearing the error is a real state change, so re-create the object without it.
    return this.replace(id, {
      definition: connection.definition,
      status: 'connected',
      lastSyncedAt: now(),
    });
  }

  async forceSync(id: string): Promise<IntegrationConnection> {
    const connection = this.require(id);
    if (NON_WORKING.has(connection.status) || connection.status === 'error') {
      mockError(
        API_STATUS.Conflict,
        'cannot_sync',
        `${connection.definition.name} cannot be synced.`,
        'Only a connected integration can be synced.',
        'Connect or reconnect it first.',
      );
    }
    return this.transition(id, { status: 'connected', lastSyncedAt: now() });
  }

  async getSummary(): Promise<ConnectionSummary> {
    const all = [...this.connections.values()];
    const connected = all.filter((c) => !NON_WORKING.has(c.status));

    const summary: ConnectionSummary = {
      connected: connected.length,
      total: all.length,
      needsAttention: all.filter((c) => c.status === 'error').length,
      // Healthy connections first, most recently synced first, capped for the widget.
      preview: connected
        .filter((c) => c.status === 'connected')
        .sort((a, b) => (b.lastSyncedAt ?? '').localeCompare(a.lastSyncedAt ?? ''))
        .slice(0, 8),
    };

    const { data } = await mockRespond(summary);
    return data;
  }

  // --- internals ---------------------------------------------------------

  private require(id: string): IntegrationConnection {
    const connection = this.connections.get(id);
    if (!connection) {
      mockError(
        API_STATUS.NotFound,
        'integration_not_found',
        'That integration is not in the catalogue.',
        `No integration exists with id "${id}".`,
        'Choose an integration from the catalogue.',
      );
    }
    return connection;
  }

  /** Patch a connection, preserving its definition and any unspecified fields. */
  private async transition(
    id: string,
    changes: Partial<Omit<IntegrationConnection, 'definition'>>,
  ): Promise<IntegrationConnection> {
    const current = this.require(id);
    const next: IntegrationConnection = { ...current, ...changes };
    // A working status must never carry a stale error reason.
    if (next.status !== 'error') delete next.errorReason;
    return this.replace(id, next);
  }

  private async replace(
    id: string,
    next: IntegrationConnection,
  ): Promise<IntegrationConnection> {
    this.connections.set(id, next);
    const { data } = await mockRespond(next);
    return data;
  }
}

function now(): string {
  return new Date().toISOString();
}
