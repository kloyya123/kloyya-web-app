/**
 * Mock seed data for integrations.
 *
 * The CATALOGUE itself is product configuration and now lives in @kloyya/core,
 * shared with the API that has to honour the permissions it advertises. Only the
 * "which of these start out connected" seed is mock, and it stays here.
 */
export { INTEGRATION_CATALOG } from '@kloyya/core/integration-catalogue';

export const INITIALLY_CONNECTED: ReadonlyArray<{
  id: string;
  error?: string;
  minutesSinceSync: number;
}> = [
  { id: 'gmail', minutesSinceSync: 0.2 },
  { id: 'google_calendar', minutesSinceSync: 1 },
  { id: 'google_drive', minutesSinceSync: 14 },
  { id: 'notion', minutesSinceSync: 22 },
  { id: 'confluence', minutesSinceSync: 45 },
  { id: 'dropbox', minutesSinceSync: 130 },
  { id: 'slack', minutesSinceSync: 3 },
  { id: 'microsoft_teams', minutesSinceSync: 720, error: 'Sync has been paused for 12 hours. Reconnect to resume.' },
  { id: 'salesforce', minutesSinceSync: 2880, error: 'Access token expired. Re-authorize to restore CRM context.' },
  { id: 'hubspot', minutesSinceSync: 30 },
  { id: 'jira', minutesSinceSync: 6 },
  { id: 'github', minutesSinceSync: 2 },
  { id: 'outlook', minutesSinceSync: 8 },
  { id: 'onedrive', minutesSinceSync: 55 },
];
