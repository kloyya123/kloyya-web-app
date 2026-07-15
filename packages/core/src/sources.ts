import type { EvidenceSourceType, IsoTimestamp, Score } from './domain.js';

/**
 * The Intelligence Transparency model.
 *
 * From "Kloyya Intelligence Explainability" and "Trusted Knowledge Search": the
 * product must show *where* its intelligence comes from and *how* it was
 * assembled — connected sources, their health and freshness, and the staged
 * reasoning pipeline. This turns "Evidence Before Confidence" from a principle
 * into a surface.
 */

/**
 * A connected data source. Union of the KIF integration catalogue and the
 * internal AI-memory sources the spec lists ("Long-Term Memory", "Knowledge
 * Graph", "Context Engine").
 */
export const SOURCE_PROVIDERS = [
  // Personal
  'gmail',
  'outlook',
  'google_calendar',
  'microsoft_calendar',
  // Organization / files
  'google_drive',
  'onedrive',
  'dropbox',
  'notion',
  'confluence',
  // Communication
  'slack',
  'microsoft_teams',
  // Business
  'salesforce',
  'hubspot',
  'jira',
  'github',
  // AI intelligence (internal)
  'organization_memory',
  'knowledge_graph',
  'context_engine',
] as const;
export type SourceProvider = (typeof SOURCE_PROVIDERS)[number];

/** The spec's grouping: Personal, Organization, External, AI Intelligence. */
export const SOURCE_CATEGORIES = ['personal', 'organization', 'external', 'ai'] as const;
export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

/**
 * Connection health. `healthy` and `syncing` are working states; the rest need
 * a human. The spec's Health Dashboard splits sources into "Healthy" and
 * "Needs Attention" — everything that is not healthy or syncing is the latter.
 */
export const SOURCE_STATUSES = [
  'healthy',
  'syncing',
  'needs_attention',
  'token_expired',
  'disconnected',
] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

/** KIF permission mapping: what Kloyya may do with the source. */
export const SOURCE_PERMISSIONS = ['read_only', 'read_write', 'ai_read', 'admin'] as const;
export type SourcePermission = (typeof SOURCE_PERMISSIONS)[number];

export interface ConnectedSource {
  id: string;
  provider: SourceProvider;
  displayName: string;
  category: SourceCategory;
  /** The evidence type this source produces, linking a source to its citations. */
  evidenceType: EvidenceSourceType;
  status: SourceStatus;
  permission: SourcePermission;
  /** 0–100. How fresh the indexed data is. */
  freshness: Score;
  /** 0–100. Knowledge confidence in this source's data. */
  confidence: Score;
  lastSyncedAt: IsoTimestamp;
  /**
   * How many current recommendations cite this source. Derived from the shared
   * evidence set, never hand-set, so the number always matches reality.
   */
  referencedByCount: number;
  /** Present only when the status needs a human. Explains what is wrong. */
  attentionReason?: string;
}

/**
 * The organization's intelligence health, per the spec's Health Dashboard.
 * Every field is derived from the source set, so it cannot drift from it.
 */
export interface IntelligenceHealth {
  totalSources: number;
  healthy: number;
  needsAttention: number;
  /** 0–100. Share of the source catalogue that is connected and usable. */
  knowledgeCoverage: Score;
  /** Average freshness across healthy sources, in minutes. */
  averageFreshnessMinutes: number;
  recommendationConfidence: Score;
  aiAccuracy: Score;
}

// ---------------------------------------------------------------------------
// The reasoning pipeline
// ---------------------------------------------------------------------------

/**
 * The stages of a single intelligence run, in order.
 *
 * From the spec's Intelligence Timeline:
 * "Intent detected → Searching sources → Finding relationships → Checking
 *  previous decisions → Ranking evidence → Scoring confidence → Generating".
 */
export const PIPELINE_STAGES = [
  'intent',
  'retrieval',
  'context',
  'relationships',
  'decisions',
  'ranking',
  'scoring',
  'generation',
] as const;
export type PipelineStageKind = (typeof PIPELINE_STAGES)[number];

export type PipelineStageStatus = 'pending' | 'active' | 'complete';

export interface PipelineStage {
  kind: PipelineStageKind;
  /** In the interface's voice: "Searching your approved sources". */
  label: string;
  status: PipelineStageStatus;
  /** Set once the stage begins. */
  startedAt?: IsoTimestamp;
  /** Set once it finishes. */
  completedAt?: IsoTimestamp;
  /** Expandable detail — the spec: "Users can expand any step to inspect details." */
  detail?: string;
}

/**
 * Why a source was or was not used for a given request.
 * The spec's "Source Inclusion & Exclusion Reasoning": complete transparency
 * into retrieval decisions.
 */
export interface SourceUsage {
  sourceId: string;
  provider: SourceProvider;
  displayName: string;
  included: boolean;
  /** "Meeting starts within 24 hours." / "Permission not granted." */
  reason: string;
}

/**
 * Per-recommendation coverage estimate: how complete the available information
 * was. The spec's "Knowledge Coverage Indicator".
 */
export interface KnowledgeCoverage {
  /** 0–100. */
  coverage: Score;
  /** Providers that would improve the answer if connected. */
  missingProviders: SourceProvider[];
}
