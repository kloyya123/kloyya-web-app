import { mockEvidence } from './organization';
import type { EvidenceSourceType } from '@/types/domain';
import type {
  ConnectedSource,
  SourceCategory,
  SourcePermission,
  SourceProvider,
  SourceStatus,
} from '@/types/sources';

/**
 * Northwind Robotics' connected intelligence network.
 *
 * 18 sources — mostly healthy, two that need a human — so the Health Dashboard,
 * the "needs attention" state, and the exclusion reasoning all have something
 * real to show. Per the spec, breadth is the point: "Users immediately
 * understand the breadth of Kloyya's intelligence network."
 */

const NOW = new Date('2026-07-10T08:00:00.000Z');
const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

/**
 * How many pieces of live evidence come from each evidence type.
 *
 * Derived, not hand-set: `referencedByCount` on a source must match the number
 * of recommendation citations that actually resolve to it, or the Trust Center
 * would claim a source is cited when nothing cites it.
 */
function referenceCounts(): Map<EvidenceSourceType, number> {
  const counts = new Map<EvidenceSourceType, number>();
  for (const evidence of mockEvidence) {
    counts.set(evidence.sourceType, (counts.get(evidence.sourceType) ?? 0) + 1);
  }
  return counts;
}

interface SourceSeed {
  id: string;
  provider: SourceProvider;
  displayName: string;
  category: SourceCategory;
  evidenceType: EvidenceSourceType;
  status: SourceStatus;
  permission: SourcePermission;
  freshness: number;
  confidence: number;
  syncedMinsAgo: number;
  attentionReason?: string;
}

const SEEDS: SourceSeed[] = [
  // Personal
  { id: 'src_gmail', provider: 'gmail', displayName: 'Gmail', category: 'personal', evidenceType: 'email', status: 'healthy', permission: 'read_only', freshness: 99, confidence: 96, syncedMinsAgo: 0.2 },
  { id: 'src_gcal', provider: 'google_calendar', displayName: 'Google Calendar', category: 'personal', evidenceType: 'calendar', status: 'healthy', permission: 'read_only', freshness: 100, confidence: 98, syncedMinsAgo: 1 },
  // Organization / files
  { id: 'src_gdrive', provider: 'google_drive', displayName: 'Google Drive', category: 'organization', evidenceType: 'document', status: 'healthy', permission: 'read_only', freshness: 88, confidence: 91, syncedMinsAgo: 14 },
  { id: 'src_notion', provider: 'notion', displayName: 'Notion', category: 'organization', evidenceType: 'knowledge_base', status: 'healthy', permission: 'read_write', freshness: 82, confidence: 89, syncedMinsAgo: 22 },
  { id: 'src_confluence', provider: 'confluence', displayName: 'Confluence', category: 'organization', evidenceType: 'knowledge_base', status: 'healthy', permission: 'read_only', freshness: 74, confidence: 84, syncedMinsAgo: 45 },
  { id: 'src_dropbox', provider: 'dropbox', displayName: 'Dropbox', category: 'organization', evidenceType: 'document', status: 'healthy', permission: 'read_only', freshness: 61, confidence: 78, syncedMinsAgo: 130 },
  // Communication
  { id: 'src_slack', provider: 'slack', displayName: 'Slack', category: 'external', evidenceType: 'chat', status: 'healthy', permission: 'read_only', freshness: 95, confidence: 87, syncedMinsAgo: 3 },
  { id: 'src_teams', provider: 'microsoft_teams', displayName: 'Microsoft Teams', category: 'external', evidenceType: 'chat', status: 'needs_attention', permission: 'read_only', freshness: 40, confidence: 70, syncedMinsAgo: 720, attentionReason: 'Sync has been paused for 12 hours. Reconnect to resume.' },
  // Business
  { id: 'src_salesforce', provider: 'salesforce', displayName: 'Salesforce', category: 'external', evidenceType: 'crm', status: 'token_expired', permission: 'read_only', freshness: 20, confidence: 62, syncedMinsAgo: 2880, attentionReason: 'Access token expired. Re-authorize to restore CRM context.' },
  { id: 'src_hubspot', provider: 'hubspot', displayName: 'HubSpot', category: 'external', evidenceType: 'crm', status: 'healthy', permission: 'read_only', freshness: 79, confidence: 83, syncedMinsAgo: 30 },
  { id: 'src_jira', provider: 'jira', displayName: 'Jira', category: 'external', evidenceType: 'project_update', status: 'healthy', permission: 'read_only', freshness: 92, confidence: 90, syncedMinsAgo: 6 },
  { id: 'src_github', provider: 'github', displayName: 'GitHub', category: 'external', evidenceType: 'project_update', status: 'healthy', permission: 'read_only', freshness: 97, confidence: 88, syncedMinsAgo: 2 },
  { id: 'src_outlook', provider: 'outlook', displayName: 'Outlook', category: 'personal', evidenceType: 'email', status: 'healthy', permission: 'read_only', freshness: 90, confidence: 92, syncedMinsAgo: 8 },
  { id: 'src_onedrive', provider: 'onedrive', displayName: 'OneDrive', category: 'organization', evidenceType: 'document', status: 'healthy', permission: 'read_only', freshness: 70, confidence: 80, syncedMinsAgo: 55 },
  // AI intelligence (internal, always fresh)
  { id: 'src_org_memory', provider: 'organization_memory', displayName: 'Organization Memory', category: 'ai', evidenceType: 'knowledge_base', status: 'healthy', permission: 'ai_read', freshness: 100, confidence: 94, syncedMinsAgo: 0.1 },
  { id: 'src_knowledge_graph', provider: 'knowledge_graph', displayName: 'Knowledge Graph', category: 'ai', evidenceType: 'knowledge_base', status: 'healthy', permission: 'ai_read', freshness: 100, confidence: 93, syncedMinsAgo: 0.1 },
  { id: 'src_context_engine', provider: 'context_engine', displayName: 'Context Engine', category: 'ai', evidenceType: 'project_update', status: 'healthy', permission: 'ai_read', freshness: 100, confidence: 91, syncedMinsAgo: 0.1 },
  { id: 'src_meeting_notes', provider: 'notion', displayName: 'Meeting Notes', category: 'organization', evidenceType: 'meeting_notes', status: 'healthy', permission: 'read_write', freshness: 85, confidence: 92, syncedMinsAgo: 18 },
];

export const mockSources: ConnectedSource[] = (() => {
  const counts = referenceCounts();
  return SEEDS.map((seed) => {
    const { syncedMinsAgo, attentionReason, ...rest } = seed;
    const source: ConnectedSource = {
      ...rest,
      lastSyncedAt: minsAgo(syncedMinsAgo),
      // Every source of this evidence type shares the citation count. Good enough
      // for a mock, and it keeps the total honest against the evidence set.
      referencedByCount: counts.get(seed.evidenceType) ?? 0,
    };
    if (attentionReason !== undefined) source.attentionReason = attentionReason;
    return source;
  });
})();

/** The clock the mock network is pinned to, exported for deterministic tests. */
export const MOCK_SOURCES_NOW = NOW;
