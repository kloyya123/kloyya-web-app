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
  // Outlook is deliberately absent: the demo needs one tool still waiting to be
  // connected, and a catalogue where everything is already on shows nothing.
  { id: 'gmail', minutesSinceSync: 0.2 },
  { id: 'google_calendar', minutesSinceSync: 1 },
  { id: 'google_drive', minutesSinceSync: 14 },
  { id: 'notion', minutesSinceSync: 22 },
  { id: 'whatsapp_business', minutesSinceSync: 3 },
  {
    id: 'outlook_calendar',
    minutesSinceSync: 720,
    error: 'Sync has been paused for 12 hours. Reconnect to resume.',
  },
];
