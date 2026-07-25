import type {
  IntegrationCategory,
  IntegrationDefinition,
  IntegrationPermissions,
} from './integrations.js';

/**
 * The integration catalogue — PRIVATE BETA.
 *
 * Six tools, not fifty. Kloyya Core Integrations (Private Beta) picks the set
 * that carries the most context per connection — email, calendar, and the two
 * places their documents live.
 *
 * WhatsApp Business is deliberately ABSENT despite being a headline beta
 * integration: the WhatsApp Cloud API cannot read message history at all.
 * Messages arrive only by webhook, forward-only, from the moment you connect. A
 * card promising to "summarize customer conversations" would summarize nothing
 * on the day it was clicked. It returns when it can keep that promise.
 * The long tail (Slack, Teams, Jira, Salesforce, GitHub, …) is documented as a
 * post-beta expansion and is deliberately absent: a catalogue is a promise that
 * each card works, and a card we cannot sync is a promise we are not keeping.
 *
 * Every id here is one the backend either syncs today (Google Calendar) or is
 * next to build. Adding a card is cheap; adding a card that does nothing costs a
 * user their trust the first time they click it.
 *
 * This is product configuration, not mock data, which is why it lives in
 * @kloyya/core rather than the web app's mock folder: the permission copy below
 * is a promise made to the user at the point of connecting ("Kloyya will read
 * your calendar; it will never share your data externally"), and the API is what
 * has to keep it. One catalogue, so the card cannot offer a scope the connector
 * doesn't request, and the connector cannot request one the card never showed.
 *
 * Permission sets are defined per category (what a calendar tool can expose is
 * the same whether it is Google's or Apple's), so every card carries the
 * spec-mandated review: what Kloyya will read, and what it will never do.
 * "Share data externally" is on every not-granted list deliberately.
 */

const PERMISSIONS: Record<IntegrationCategory, IntegrationPermissions> = {
  communication: {
    granted: ['Read messages', 'Read threads', 'Read attachments'],
    notGranted: ['Send messages', 'Delete messages', 'Share data externally'],
  },
  calendar: {
    granted: ['Read calendars', 'Read events', 'Read attendees', 'Read reminders'],
    notGranted: ['Edit events', 'Delete events', 'Share data externally'],
  },
  documents: {
    granted: ['Read files', 'Read folder structure', 'Read sharing metadata'],
    notGranted: ['Edit files', 'Delete files', 'Share data externally'],
  },
  project_management: {
    granted: ['Read projects', 'Read tasks', 'Read comments'],
    notGranted: ['Edit tasks', 'Delete items', 'Share data externally'],
  },
  crm: {
    granted: ['Read contacts', 'Read deals', 'Read activity history'],
    notGranted: ['Edit records', 'Delete records', 'Share data externally'],
  },
  engineering: {
    granted: ['Read repositories', 'Read issues', 'Read pull requests'],
    notGranted: ['Write code', 'Merge changes', 'Share data externally'],
  },
  design: {
    granted: ['Read files', 'Read comments'],
    notGranted: ['Edit designs', 'Share data externally'],
  },
  meetings: {
    granted: ['Read meetings', 'Read recordings', 'Read transcripts'],
    notGranted: ['Schedule meetings', 'Delete recordings', 'Share data externally'],
  },
  finance: {
    granted: ['Read invoices', 'Read transactions'],
    notGranted: ['Create payments', 'Edit records', 'Share data externally'],
  },
  cloud_storage: {
    granted: ['Read objects', 'Read metadata'],
    notGranted: ['Write objects', 'Delete objects', 'Share data externally'],
  },
  ai_productivity: {
    granted: ['Read conversations you choose to share'],
    notGranted: ['Send prompts on your behalf', 'Share data externally'],
  },
  hr: {
    granted: ['Read directory', 'Read org structure'],
    notGranted: ['Edit employee data', 'Share data externally'],
  },
  marketing: {
    granted: ['Read campaigns', 'Read performance metrics'],
    notGranted: ['Send campaigns', 'Edit audiences', 'Share data externally'],
  },
  custom: {
    granted: ['Read the endpoints you approve'],
    notGranted: ['Write operations unless explicitly granted', 'Share data externally'],
  },
};

function define(
  id: string,
  name: string,
  category: IntegrationCategory,
  description: string,
  estimatedSyncMinutes: number,
): IntegrationDefinition {
  return { id, name, category, description, permissions: PERMISSIONS[category], estimatedSyncMinutes };
}

export const INTEGRATION_CATALOG: IntegrationDefinition[] = [
  // Email — "the central communication hub for nearly every organization".
  define('gmail', 'Gmail', 'communication', 'Understands your email threads, priorities, and follow-ups.', 12),
  define('outlook', 'Outlook', 'communication', 'Understands your email threads, priorities, and follow-ups.', 12),
  // Calendar — "understand the user's schedule".
  define('google_calendar', 'Google Calendar', 'calendar', 'Knows your schedule, attendees, and preparation windows.', 3),
  define('outlook_calendar', 'Outlook Calendar', 'calendar', 'Knows your schedule, attendees, and preparation windows.', 3),
  // Documents & knowledge.
  define('google_drive', 'Google Drive', 'documents', 'Indexes the documents your decisions depend on.', 25),
  define('notion', 'Notion', 'documents', 'Turns your workspace pages into organizational memory.', 15),
  // Team communication.
  define('slack', 'Slack', 'communication', 'Reads your conversations, threads, and shared documents.', 10),
];


/**
 * Which integrations Northwind already has connected — the same set that powers
 * the Phase-11 source network, so the Trust Center, the Connection Manager, and
 * the dashboard widget all tell one story. Salesforce's expired token and
 * Teams' paused sync appear here as errors, exactly as they do in /trust.
 */
