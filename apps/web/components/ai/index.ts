/**
 * The Kloyya AI component library.
 *
 * KFA and KDS both name these eight primitives. They exist as a set, before any
 * feature that shows intelligence, so that "how do we display a confidence
 * score?" is answered once rather than four times.
 *
 * The DCTF Golden Rules are enforced by the types these components consume:
 * a `Recommendation` carries non-empty evidence and reasoning, so a card that
 * hides its evidence is not something you can accidentally build here.
 */

export { AgentStatusList, AgentStatusRow } from './agent-status';
export { ConfidenceBadge, type ConfidenceBadgeProps } from './confidence-badge';
export { EvidenceViewer, SOURCE_ICON, SourceReferences, type EvidenceViewerProps } from './evidence-viewer';
export { ExecutiveBrief } from './executive-brief';
export { FeedbackPanel, type FeedbackPanelProps } from './feedback-panel';
export { ReasoningPanel, type ReasoningPanelProps } from './reasoning-panel';
export {
  RecommendationCard,
  type RecommendationCardProps,
} from './recommendation-card';
