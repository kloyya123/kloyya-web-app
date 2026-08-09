import type { IntegrationCategory } from '@/types/integrations';

/**
 * Landing page copy, in one place.
 *
 * Separated from the components so the words can be edited without touching
 * layout — marketing copy changes far more often than the markup around it.
 * Every claim here has to stay true of the shipped product; a landing page that
 * promises a capability the app does not have is a bug, not a stretch goal.
 */

/**
 * The one address Kloyya answers.
 *
 * Defined once because the site previously advertised three — hello@, support@
 * and press@ — of which only this one exists. A footer link to an address that
 * bounces is worse than no link: the visitor writes, hears nothing, and
 * concludes we ignored them.
 */
export const CONTACT_EMAIL = 'contactsupport@kloyya.com';

export interface Tool {
  name: string;
  /** Connectable today, or on the roadmap. */
  live: boolean;
  /** The catalogue id, where one exists — feeds the real icon lookup in
   *  integration-meta.ts rather than a bespoke landing-page icon set. */
  id: string;
  category: IntegrationCategory;
}

/**
 * What a visitor is told they can connect.
 *
 * Every `live: true` entry is connectable today; the flag is what keeps the
 * grid honest rather than aspirational — Outlook is hidden from the product's
 * own UI pending its Azure redirect URI, and stays off this list for the same
 * reason. Slack has a real OAuth flow, a real events webhook, and a real
 * connector now — see server/integrations/slack.ts and the events route — so
 * it moved to `live: true` alongside the rest.
 */
export const TOOLS: Tool[] = [
  { name: 'Gmail', live: true, id: 'gmail', category: 'communication' },
  { name: 'Google Calendar', live: true, id: 'google_calendar', category: 'calendar' },
  { name: 'Google Drive', live: true, id: 'google_drive', category: 'documents' },
  { name: 'Notion', live: true, id: 'notion', category: 'documents' },
  { name: 'Slack', live: true, id: 'slack', category: 'communication' },
];
