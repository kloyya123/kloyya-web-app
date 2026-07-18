/**
 * The Kloyya domain model.
 *
 * Synthesized from KDA (entities/fields), KDSE (scoring), DCTF (trust/evidence),
 * KARE (reasoning), KOMGA (graph), KMSA (memory), and KAOP (observability).
 *
 * Those documents name fields but never give types, IDs, or formats. The
 * decisions taken here, once, so they are not re-taken per file:
 *
 *   - ids are opaque `string` (UUID at runtime)
 *   - timestamps are ISO-8601 `string`, never `Date` (a Date cannot cross the
 *     server/client boundary in Next without serialization, and drifts on parse)
 *   - all scores are `number` on a 0–100 scale, never 0–1
 *
 * Where documents conflict, the resolution is annotated at the point of conflict.
 */

import type { SubscriptionTier } from './preferences.js';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** ISO-8601, e.g. "2026-07-10T08:30:00.000Z". */
export type IsoTimestamp = string;

/** 0–100 inclusive. */
export type Score = number;

/**
 * KDA: "Every table includes: Organization ID, Workspace ID, Created By,
 * Updated By, Created At, Updated At, Soft Delete Flag, Version."
 *
 * `passwordHash` and other server-only columns are deliberately absent — this
 * is the client-facing projection, and a type is the cheapest place to prevent
 * a secret from ever reaching a component.
 */
export interface BaseEntity {
  id: string;
  organizationId: string;
  workspaceId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  version: number;
}

// ---------------------------------------------------------------------------
// Scoring — KDSE
// ---------------------------------------------------------------------------

/**
 * KDSE Priority Levels, with the exact score bands the spec gives.
 * These bands drive *where* an item may surface, not merely how it looks.
 */
export const PRIORITY_LEVELS = [
  'Critical',
  'High',
  'Medium',
  'Low',
  'Background',
] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

/**
 * DCTF risk classification.
 *
 * Conflict: KARE's Risk Engine models risk as severity + likelihood + impact,
 * with no enum. KAOP uses free-form severity. DCTF gives the only closed set,
 * so DCTF wins and the others are treated as inputs that produce this level.
 */
export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

// ---------------------------------------------------------------------------
// Evidence & Trust — DCTF
// ---------------------------------------------------------------------------

/**
 * Where a piece of evidence came from. Union of the integration catalogue (KIF)
 * and the evidence source types DCTF enumerates.
 */
export const EVIDENCE_SOURCE_TYPES = [
  'email',
  'calendar',
  'meeting_notes',
  'document',
  'knowledge_base',
  'crm',
  'project_update',
  'task_history',
  'chat',
  'user_preference',
  'integration',
] as const;
export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

/**
 * DCTF Stage 1: "Each evidence source receives: Source ID, Timestamp,
 * Reliability score, Freshness score, Ownership, Permission level."
 */
export interface Evidence {
  id: string;
  sourceType: EvidenceSourceType;
  /** Human-readable origin, e.g. "Gmail — thread with Acme Legal". */
  sourceLabel: string;
  /** What this evidence actually says. Shown verbatim in the Evidence Viewer. */
  excerpt: string;
  /** When the underlying source was last modified — not when we read it. */
  timestamp: IsoTimestamp;
  reliability: Score;
  freshness: Score;
  /** User id of the owner of the source record. */
  ownerId: string;
  /** KESM data classification. Governs whether the excerpt may be displayed. */
  classification: DataClassification;
  /** Deep link into the source system, when one exists. */
  href?: string;
}

/** KESM: "Public, Internal, Confidential, Highly Confidential, Restricted, Regulated." */
export const DATA_CLASSIFICATIONS = [
  'public',
  'internal',
  'confidential',
  'highly_confidential',
  'restricted',
  'regulated',
] as const;
export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

/**
 * A single step in the reasoning chain. KARE requires that a recommendation
 * explain "what happened, why it matters, what to do, why it is trustworthy."
 */
export interface ReasoningStep {
  id: string;
  /** One sentence, in the interface's voice. */
  statement: string;
  /** Evidence ids this step rests on. Empty means the step is an inference. */
  evidenceIds: string[];
}

/**
 * DCTF Stage 10: "Conflicting information detected."
 * Never silently resolved — the Golden Rules forbid ignoring conflicting data.
 */
export interface Conflict {
  id: string;
  summary: string;
  conflictingEvidenceIds: [string, string, ...string[]];
  recommendedResolution: string;
}

// ---------------------------------------------------------------------------
// Recommendation — the product's central object
// ---------------------------------------------------------------------------

/** The action a recommendation proposes. Never a bare label. */
export interface SuggestedAction {
  /** Imperative and specific. "Reschedule the design review", not "Review project". */
  label: string;
  /** Where the action leads, if it is navigational. */
  href?: string;
  /**
   * DCTF Stage 7: "Never automate destructive actions without user approval."
   * When true the UI must interpose a confirmation step.
   */
  isDestructive: boolean;
}

/**
 * DCTF interaction outcome — what the user *did* with a recommendation.
 *
 * Conflict resolution: DCTF gives (completed | dismissed | postponed | edited |
 * ignored); KAOP gives (Accepted | Rejected | Ignored | Modified) and separately
 * eight quality ratings. These are two orthogonal axes wearing one name. Here
 * the axes are split: `RecommendationOutcome` is what happened,
 * `FeedbackRating` is what the user thought of it. Both can be recorded for the
 * same recommendation, or neither.
 */
export const RECOMMENDATION_OUTCOMES = [
  'pending',
  'accepted',
  'completed',
  'dismissed',
  'postponed',
  'edited',
  'ignored',
] as const;
export type RecommendationOutcome = (typeof RECOMMENDATION_OUTCOMES)[number];

/** KAOP quality ratings. Orthogonal to outcome — see above. */
export const FEEDBACK_RATINGS = [
  'excellent',
  'helpful',
  'not_helpful',
  'incorrect',
  'incomplete',
  'outdated',
  'unsafe',
  'needs_improvement',
] as const;
export type FeedbackRating = (typeof FEEDBACK_RATINGS)[number];

/** KDSE Delivery Engine: where a recommendation is allowed to appear. */
export const DELIVERY_CHANNELS = [
  'push_notification',
  'dashboard',
  'morning_briefing',
  'executive_brief',
  'email',
  'recommendation_feed',
  'search',
  'knowledge',
  'background_index',
] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

/**
 * A non-empty list. The type system enforces DCTF's first Golden Rule:
 * "Never recommend without evidence."
 *
 * `Evidence[]` would let `evidence: []` compile. This will not.
 */
export type NonEmpty<T> = [T, ...T[]];

/**
 * KARE: "every recommendation must contain Title, Reason, Confidence Score,
 * Evidence, Suggested Action, Expected Outcome."
 * DCTF adds: assumptions, what happens if ignored, risk, conflicts, audit trail.
 *
 * Every one of those is required below. A `Recommendation` that cannot explain
 * itself cannot be constructed.
 */
export interface Recommendation extends BaseEntity {
  title: string;
  /** Why this surfaced, in one sentence. */
  reason: string;

  /** 0–100. DCTF treats confidence as a percentage, never a band. */
  confidence: Score;
  /** 0–100 composite across KDSE's 15 dimensions. */
  decisionScore: Score;
  /** Derived from decisionScore. Never set independently — see lib/decision-score.ts. */
  priority: PriorityLevel;
  risk: RiskLevel;

  evidence: NonEmpty<Evidence>;
  reasoning: NonEmpty<ReasoningStep>;
  /** DCTF Stage 4: "What assumptions." May legitimately be empty. */
  assumptions: string[];
  /** DCTF Stage 10. Empty when sources agree. */
  conflicts: Conflict[];

  suggestedAction: SuggestedAction;
  expectedOutcome: string;
  /** DCTF Stage 4: "What happens if ignored." */
  whatHappensIfIgnored: string;

  /** DCTF Stage 7. Independent of `suggestedAction.isDestructive`: a
   *  low-confidence non-destructive action may still warrant confirmation. */
  confirmationRequired: boolean;

  /** Which agent produced this. KAOP attributes every output to an agent. */
  generatedByAgent: AgentKind;
  deliveryChannels: DeliveryChannel[];

  outcome: RecommendationOutcome;
  feedbackRating?: FeedbackRating;
}

// ---------------------------------------------------------------------------
// Agents — KAIA
// ---------------------------------------------------------------------------

export const AGENT_KINDS = [
  'master_orchestrator',
  'executive_briefing',
  'calendar_intelligence',
  'meeting_intelligence',
  'email_intelligence',
  'knowledge',
  'search',
  'recommendation',
  'risk',
  'organizational_memory',
  'research',
  'document_understanding',
  'workflow',
  'automation',
  'decision',
  'security',
] as const;
export type AgentKind = (typeof AGENT_KINDS)[number];

export const AGENT_STATUSES = ['idle', 'thinking', 'acting', 'blocked', 'failed'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export interface Agent {
  kind: AgentKind;
  displayName: string;
  status: AgentStatus;
  /** What it is doing right now, in the interface's voice. Null when idle. */
  activity: string | null;
  lastActiveAt: IsoTimestamp;
}

// ---------------------------------------------------------------------------
// People & tenancy — KDA / KESM
// ---------------------------------------------------------------------------

/** KESM RBAC roles, including the machine principals it names. */
export const ROLES = [
  'owner',
  'administrator',
  'executive',
  'manager',
  'team_lead',
  'employee',
  'contractor',
  'guest',
  'auditor',
  'support',
  'ai_service',
  'automation_service',
] as const;
export type Role = (typeof ROLES)[number];

export interface User {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  jobTitle: string;
  role: Role;
  timezone: string;
  /** False until the verify-email step completes. Gates workspace access. */
  isEmailVerified: boolean;
  /** False until onboarding completes. Gates the dashboard. */
  hasCompletedOnboarding: boolean;
  createdAt: IsoTimestamp;
}

export interface Organization {
  id: string;
  name: string;
  industry: string;
  logoUrl?: string;
  plan: 'starter' | 'growth' | 'enterprise';
  /** Beta subscription tier — Free or Pro (no Max during the private beta).
   *  Chosen on the onboarding plan step; the org concept is internal-only now. */
  subscriptionTier: SubscriptionTier;
}

export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  /** Trust Score (DCTF), 0–100. Surfaced on the dashboard. */
  trustScore: Score;
}

// ---------------------------------------------------------------------------
// Work entities — KDA
// ---------------------------------------------------------------------------

export const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task extends BaseEntity {
  title: string;
  status: TaskStatus;
  priority: PriorityLevel;
  ownerId: string;
  projectId?: string;
  dueAt?: IsoTimestamp;
  /** KDA: "AI Priority Score". Distinct from `priority`, which is human-set. */
  aiPriorityScore: Score;
}

export const PROJECT_STATUSES = ['planning', 'active', 'at_risk', 'paused', 'complete'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface Project extends BaseEntity {
  name: string;
  status: ProjectStatus;
  ownerId: string;
  /** 0–100. */
  progress: Score;
  riskScore: Score;
  /** KDA + V1 spec: "AI Health Score". */
  healthScore: Score;
  deadline?: IsoTimestamp;
}

/** One factor moving a project's health, in either direction. */
export interface ProjectHealthDriver {
  label: string;
  effect: 'positive' | 'negative';
  detail: string;
}

/**
 * Why a project's health score reads the way it does — the Golden Rule applied
 * to a number. Fetched on demand (the parallel to MeetingBriefing); a health
 * score without this is a verdict without a reason, which the product forbids.
 */
export interface ProjectHealth {
  projectId: string;
  headline: string;
  drivers: NonEmpty<ProjectHealthDriver>;
  confidence: Score;
}

export interface MeetingParticipant {
  userId: string;
  fullName: string;
  avatarUrl?: string;
}

export interface Meeting extends BaseEntity {
  title: string;
  startsAt: IsoTimestamp;
  endsAt: IsoTimestamp;
  participants: MeetingParticipant[];
  /** Null before the meeting happens. */
  summary: string | null;
  agenda: string[];
  actionItems: string[];
  /** KDA names Decisions on the meeting entity. Empty until the meeting ends. */
  decisions: string[];
  /** Follow-ups distinct from action items: things to watch, not things to do. */
  followUps: string[];
  projectId?: string;
  /** Confidence in the AI-generated summary. Null when there is no summary. */
  summaryConfidence: Score | null;
}

/**
 * The pre-meeting intelligence — "walk into meetings prepared".
 *
 * Golden Rules apply as everywhere: a briefing is a claim about what matters,
 * so it carries its confidence and non-empty evidence, or it cannot exist.
 */
export interface MeetingBriefing {
  meetingId: string;
  /** Why this meeting matters, in one sentence. */
  headline: string;
  /** What to walk out with. */
  objective: string;
  talkingPoints: string[];
  /** What could derail it. May be empty for a routine meeting. */
  risks: string[];
  confidence: Score;
  evidence: NonEmpty<Evidence>;
}

export interface EmailThread extends BaseEntity {
  subject: string;
  senderName: string;
  senderEmail: string;
  receivedAt: IsoTimestamp;
  /** AI-generated, one sentence. */
  aiSummary: string;
  isUnread: boolean;
  /** 0–100. Drives Priority Inbox ordering. */
  importanceScore: Score;
  /**
   * Why this thread ranks where it does. A Golden Rule made structural: the
   * inbox never sorts by an invisible score — it always says what it saw.
   */
  importanceReason: string;
  /** Awaiting a reply from you. Drives Follow-Up Reminders. */
  needsReply: boolean;
}

/** A meeting Kloyya spotted being proposed inside an email. */
export interface DetectedMeeting {
  title: string;
  /** Null when a time is discussed but not pinned down. */
  proposedAt: IsoTimestamp | null;
  /** What in the thread suggested it. */
  note: string;
}

/**
 * Per-email AI insights, fetched on demand — the parallel to MeetingBriefing.
 *
 * Absent for routine mail; the detail view renders fine without it. Suggested
 * replies are non-empty by construction: an insights record that offers no way
 * to act is not something a reader can be handed.
 */
export interface EmailInsights {
  emailId: string;
  /** Draft replies, most-likely-intended first. */
  suggestedReplies: NonEmpty<string>;
  /** Tasks Kloyya read out of the thread. Empty when it found none. */
  extractedTasks: string[];
  /** A meeting the thread proposes, if any. */
  detectedMeeting: DetectedMeeting | null;
}

export interface KnowledgeArticle extends BaseEntity {
  title: string;
  category: string;
  /** AI-generated summary of the article body. */
  aiSummary: string;
  tags: string[];
  authorId: string;
  confidence: Score;
}

// ---------------------------------------------------------------------------
// Briefing — KARE L12
// ---------------------------------------------------------------------------

export const BRIEFING_KINDS = ['morning', 'evening', 'weekly'] as const;
export type BriefingKind = (typeof BRIEFING_KINDS)[number];

/**
 * KARE: the Morning Briefing answers "What happened? Why does it matter?
 * What should I do? Why is that trustworthy?"
 *
 * `headline` answers the first, `narrative` the second, `recommendations` the
 * third, and every recommendation carries its own evidence for the fourth.
 */
export interface Briefing {
  id: string;
  kind: BriefingKind;
  generatedAt: IsoTimestamp;
  /** One sentence. The single most important thing today. */
  headline: string;
  /** Two or three sentences of context. Never a wall of text. */
  narrative: string;
  confidence: Score;
  recommendationIds: string[];
}

// ---------------------------------------------------------------------------
// Notifications — KDS categories
// ---------------------------------------------------------------------------

export const NOTIFICATION_CATEGORIES = [
  'ai',
  'important',
  'mentions',
  'meetings',
  'tasks',
  'projects',
  'system',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  createdAt: IsoTimestamp;
  isRead: boolean;
  /** KDSE: notifications are ordered by decision score, not recency. */
  decisionScore: Score;
  href?: string;
}
