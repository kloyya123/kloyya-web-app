import type {
  ConnectedSource,
  IntelligenceHealth,
  KnowledgeCoverage,
  SourceCategory,
  SourceUsage,
} from '@/types/sources';

/**
 * The Sources / Intelligence Transparency contract.
 *
 * Everything the transparency surfaces read: the connected network, its health,
 * and — for a given recommendation — which sources were used and why. A real
 * backend implements the same interface; the retrieval-decision logic that lives
 * in the mock moves server-side unchanged.
 */
export interface SourcesService {
  /** The connected network, optionally scoped to one category. */
  listSources(category?: SourceCategory): Promise<ConnectedSource[]>;

  /** Aggregate health, derived from the source set. */
  getHealth(): Promise<IntelligenceHealth>;

  /**
   * Why each source was or was not used for a recommendation.
   * The spec's "Source Inclusion & Exclusion Reasoning".
   */
  getSourceUsage(recommendationId: string): Promise<SourceUsage[]>;

  /** How complete the available information was for a recommendation. */
  getCoverage(recommendationId: string): Promise<KnowledgeCoverage>;
}
