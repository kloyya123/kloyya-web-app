import type { IsoTimestamp } from './domain.js';

/**
 * The integration catalogue and connection lifecycle.
 *
 * From the "Select Your Tools" spec: categorized integrations, each card showing
 * description, permissions requested, estimated sync time, and connection
 * status — with a mandatory permission review before connecting.
 *
 * Distinct from `ConnectedSource` (types/sources.ts) on purpose: the catalogue
 * describes what *can* be connected; a source describes the live intelligence a
 * connection produces. The manager operates on connections; the Trust Center
 * inspects sources.
 */

export const INTEGRATION_CATEGORIES = [
  'communication',
  'calendar',
  'documents',
  'project_management',
  'crm',
  'engineering',
  'design',
  'meetings',
  'finance',
  'cloud_storage',
  'ai_productivity',
  'hr',
  'marketing',
  'custom',
] as const;
export type IntegrationCategory = (typeof INTEGRATION_CATEGORIES)[number];

/**
 * What Kloyya will and will not do with a connection.
 * The spec: "Explain exactly what Kloyya will access. Transparency is mandatory."
 * Both lists are required and non-empty — a review with nothing to review is
 * not a review.
 */
export interface IntegrationPermissions {
  granted: [string, ...string[]];
  notGranted: [string, ...string[]];
}

export interface IntegrationDefinition {
  /** Stable id, e.g. 'gmail'. Matches SourceProvider where the two overlap. */
  id: string;
  name: string;
  category: IntegrationCategory;
  /** One sentence: what connecting this teaches Kloyya. */
  description: string;
  permissions: IntegrationPermissions;
  /** Ballpark for the first full sync, shown on the card. */
  estimatedSyncMinutes: number;
}

/**
 * Connection lifecycle. `error` carries a human-readable reason and offers
 * Reconnect; `paused` keeps the data but stops syncing.
 */
export const CONNECTION_STATUSES = [
  'not_connected',
  'connecting',
  'syncing',
  'connected',
  'paused',
  'error',
] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export interface IntegrationConnection {
  definition: IntegrationDefinition;
  status: ConnectionStatus;
  lastSyncedAt: IsoTimestamp | null;
  /** Present only when status is 'error'. Says what is wrong and what to do. */
  errorReason?: string;
}

/**
 * Whether an integration counts toward "connected sources".
 *
 * Everything except `not_connected` — a paused or errored integration is still
 * connected, it just is not syncing. The single source of truth for this rule,
 * so the manager, the widget, and the summary all agree.
 */
export function isConnected(connection: IntegrationConnection): boolean {
  return connection.status !== 'not_connected';
}
