import type {
  IntegrationCategory,
  IntegrationDefinition,
  IntegrationPermissions,
} from '@/types/integrations';

/**
 * The full integration catalogue from the "Select Your Tools" spec — fourteen
 * categories, ~50 providers.
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
  // Communication
  define('gmail', 'Gmail', 'communication', 'Understands your email threads, priorities, and follow-ups.', 12),
  define('outlook', 'Outlook', 'communication', 'Understands your email threads, priorities, and follow-ups.', 12),
  define('slack', 'Slack', 'communication', 'Follows decisions and context inside your channels.', 8),
  define('microsoft_teams', 'Microsoft Teams', 'communication', 'Follows conversations and meeting chatter across teams.', 8),
  define('discord', 'Discord', 'communication', 'Follows community and team discussion you point it at.', 6),
  // Calendar
  define('google_calendar', 'Google Calendar', 'calendar', 'Knows your schedule, attendees, and preparation windows.', 3),
  define('outlook_calendar', 'Outlook Calendar', 'calendar', 'Knows your schedule, attendees, and preparation windows.', 3),
  define('apple_calendar', 'Apple Calendar', 'calendar', 'Knows your schedule, attendees, and preparation windows.', 3),
  define('calendly', 'Calendly', 'calendar', 'Sees inbound bookings before they hit your day.', 2),
  // Documents & Knowledge
  define('google_drive', 'Google Drive', 'documents', 'Indexes the documents your decisions depend on.', 25),
  define('dropbox', 'Dropbox', 'documents', 'Indexes shared files and their history.', 20),
  define('onedrive', 'OneDrive', 'documents', 'Indexes the documents your decisions depend on.', 25),
  define('sharepoint', 'SharePoint', 'documents', 'Indexes team sites and organizational documents.', 30),
  define('notion', 'Notion', 'documents', 'Turns your workspace pages into organizational memory.', 15),
  define('confluence', 'Confluence', 'documents', 'Turns your wiki into searchable organizational memory.', 20),
  define('box', 'Box', 'documents', 'Indexes enterprise files and their permissions.', 20),
  // Project Management
  define('jira', 'Jira', 'project_management', 'Tracks issues, sprints, and delivery risk.', 10),
  define('asana', 'Asana', 'project_management', 'Tracks projects, owners, and slipping work.', 8),
  define('clickup', 'ClickUp', 'project_management', 'Tracks tasks and project health.', 8),
  define('trello', 'Trello', 'project_management', 'Tracks boards and card movement.', 5),
  define('linear', 'Linear', 'project_management', 'Tracks issues, cycles, and engineering momentum.', 6),
  define('monday', 'Monday.com', 'project_management', 'Tracks boards, owners, and timelines.', 8),
  // CRM & Sales
  define('salesforce', 'Salesforce', 'crm', 'Connects customer relationships to your decisions.', 35),
  define('hubspot', 'HubSpot', 'crm', 'Connects deals and contacts to your work.', 20),
  define('pipedrive', 'Pipedrive', 'crm', 'Connects your pipeline to your priorities.', 15),
  define('zoho_crm', 'Zoho CRM', 'crm', 'Connects customer records to your work.', 15),
  // Engineering
  define('github', 'GitHub', 'engineering', 'Follows repositories, pull requests, and release risk.', 15),
  define('gitlab', 'GitLab', 'engineering', 'Follows repositories, merge requests, and pipelines.', 15),
  define('bitbucket', 'Bitbucket', 'engineering', 'Follows repositories and pull requests.', 12),
  // Design
  define('figma', 'Figma', 'design', 'Sees design files and review comments.', 8),
  define('miro', 'Miro', 'design', 'Sees boards and workshop outcomes.', 6),
  // Meetings
  define('zoom', 'Zoom', 'meetings', 'Turns recordings and transcripts into decisions and actions.', 18),
  define('google_meet', 'Google Meet', 'meetings', 'Turns meetings into summaries, decisions, and follow-ups.', 15),
  define('webex', 'Webex', 'meetings', 'Turns meetings into summaries and follow-ups.', 15),
  // Finance
  define('stripe', 'Stripe', 'finance', 'Sees revenue events that should shape priorities.', 10),
  define('quickbooks', 'QuickBooks', 'finance', 'Sees invoices and cash position.', 12),
  define('xero', 'Xero', 'finance', 'Sees invoices and cash position.', 12),
  define('netsuite', 'NetSuite', 'finance', 'Sees financial records across the organization.', 30),
  // Cloud Storage
  define('aws_s3', 'AWS S3', 'cloud_storage', 'Indexes approved buckets of organizational data.', 40),
  define('google_cloud_storage', 'Google Cloud Storage', 'cloud_storage', 'Indexes approved buckets of organizational data.', 40),
  define('azure_storage', 'Azure Storage', 'cloud_storage', 'Indexes approved containers of organizational data.', 40),
  // AI & Productivity
  define('chatgpt', 'ChatGPT', 'ai_productivity', 'Imports conversations you choose to keep as knowledge.', 5),
  define('claude', 'Claude', 'ai_productivity', 'Imports conversations you choose to keep as knowledge.', 5),
  define('perplexity', 'Perplexity', 'ai_productivity', 'Imports research threads you choose to keep.', 5),
  define('microsoft_copilot', 'Microsoft Copilot', 'ai_productivity', 'Imports work you choose to keep as knowledge.', 5),
  // HR
  define('bamboohr', 'BambooHR', 'hr', 'Understands who does what across the organization.', 10),
  define('workday', 'Workday', 'hr', 'Understands org structure and roles.', 20),
  define('rippling', 'Rippling', 'hr', 'Understands your directory and teams.', 10),
  // Marketing
  define('mailchimp', 'Mailchimp', 'marketing', 'Sees campaign performance that shapes decisions.', 8),
  define('hubspot_marketing', 'HubSpot Marketing', 'marketing', 'Sees campaigns and audience performance.', 10),
  define('meta_ads', 'Meta Ads', 'marketing', 'Sees ad spend and performance.', 8),
  define('google_ads', 'Google Ads', 'marketing', 'Sees ad spend and performance.', 8),
  // Custom
  define('custom_api', 'Custom API', 'custom', 'Connect internal systems through your own endpoints.', 0),
];


/**
 * Which integrations Northwind already has connected — the same set that powers
 * the Phase-11 source network, so the Trust Center, the Connection Manager, and
 * the dashboard widget all tell one story. Salesforce's expired token and
 * Teams' paused sync appear here as errors, exactly as they do in /trust.
 */
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
