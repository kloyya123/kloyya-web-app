import type {
  IntegrationCategory,
  IntegrationConnection,
} from '@/types/integrations';

/**
 * The Connection Manager contract.
 *
 * Everything the "Select Your Tools" surfaces operate on: listing the catalogue
 * with each app's connection state, and the lifecycle actions (connect,
 * disconnect, pause, resume, reconnect, force sync). A real backend runs the
 * OAuth handshake behind the same methods; the UI never changes.
 */
export interface IntegrationsService {
  /** The catalogue with live connection state, optionally scoped to a category. */
  listConnections(category?: IntegrationCategory): Promise<IntegrationConnection[]>;

  getConnection(id: string): Promise<IntegrationConnection>;

  /** available → connected. Throws 409 if already connected, 404 if unknown. */
  connect(id: string): Promise<IntegrationConnection>;

  /** connected → available. Throws 409 if not connected. */
  disconnect(id: string): Promise<IntegrationConnection>;

  /** connected → paused. Keeps the data, stops syncing. */
  pause(id: string): Promise<IntegrationConnection>;

  /** paused → connected. */
  resume(id: string): Promise<IntegrationConnection>;

  /** error → connected. A recovery action; throws 409 on a healthy connection. */
  reconnect(id: string): Promise<IntegrationConnection>;

  /** Refresh a connected integration's data now. Updates lastSyncedAt. */
  forceSync(id: string): Promise<IntegrationConnection>;

  /** Roll-up for the dashboard Connected Sources widget. */
  getSummary(): Promise<ConnectionSummary>;
}

export interface ConnectionSummary {
  /** Working or otherwise connected (includes paused and errored). */
  connected: number;
  /** Total catalogue size. */
  total: number;
  /** Connected but needing a human (error state). */
  needsAttention: number;
  /** The first few connected apps, for the widget's "✓ Gmail ✓ Calendar +N" line. */
  preview: IntegrationConnection[];
}
