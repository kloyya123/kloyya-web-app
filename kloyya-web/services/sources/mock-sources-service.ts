import { mockRecommendations } from '@/mock/organization';
import { mockSources } from '@/mock/sources';
import { API_STATUS } from '@/types/api';
import type { EvidenceSourceType } from '@/types/domain';
import type {
  ConnectedSource,
  IntelligenceHealth,
  KnowledgeCoverage,
  SourceCategory,
  SourceProvider,
  SourceStatus,
  SourceUsage,
} from '@/types/sources';
import { clampScore } from '@/lib/decision-score';
import { mockError, mockRespond } from '../http/mock-transport';
import type { SourcesService } from './types';

/**
 * The mock sources service.
 *
 * The include/exclude reasoning here is real logic, not canned strings: a source
 * is "included" when the recommendation actually cites its evidence type, and
 * "excluded" for a stated reason — no permission, expired token, or simply no
 * relevant data for this request. That is the spec's whole point: "complete
 * transparency into retrieval decisions."
 */

/** Working states. Everything else needs a human and is excluded from retrieval. */
const WORKING: ReadonlySet<SourceStatus> = new Set<SourceStatus>(['healthy', 'syncing']);

/** The provider a recommendation would benefit from but does not yet have. */
const IMPROVEMENT_HINTS: SourceProvider[] = ['slack', 'salesforce'];

export class MockSourcesService implements SourcesService {
  private readonly sources: ConnectedSource[];

  constructor(seed: readonly ConnectedSource[] = mockSources) {
    this.sources = seed.map((source) => ({ ...source }));
  }

  async listSources(category?: SourceCategory): Promise<ConnectedSource[]> {
    const filtered = category
      ? this.sources.filter((source) => source.category === category)
      : this.sources;
    const response = await mockRespond(filtered);
    return response.data;
  }

  async getHealth(): Promise<IntelligenceHealth> {
    const total = this.sources.length;
    const working = this.sources.filter((source) => WORKING.has(source.status));
    const needsAttention = total - working.length;

    // Coverage: the share of the network that is actually usable, weighted a
    // little by confidence so a healthy-but-low-confidence source counts less.
    const coverage =
      total === 0
        ? 0
        : (working.reduce((sum, source) => sum + source.confidence, 0) / (total * 100)) * 100;

    // Average freshness across *working* sources only. A dead source at 20%
    // must not drag the headline number for the ones doing the work.
    const avgFreshnessPct =
      working.length === 0
        ? 0
        : working.reduce((sum, source) => sum + source.freshness, 0) / working.length;
    // Map 0–100% freshness onto minutes-since-fresh: 100% ≈ 0 min, 0% ≈ 60 min.
    const averageFreshnessMinutes = Math.round(((100 - avgFreshnessPct) / 100) * 60);

    const recommendationConfidence = averageOf(
      mockRecommendations.map((rec) => rec.confidence),
    );

    const health: IntelligenceHealth = {
      totalSources: total,
      healthy: working.length,
      needsAttention,
      knowledgeCoverage: Math.round(clampScore(coverage)),
      averageFreshnessMinutes,
      recommendationConfidence: Math.round(recommendationConfidence),
      // No live accuracy telemetry in a mock; a stable, plausible figure.
      aiAccuracy: 95,
    };

    const response = await mockRespond(health);
    return response.data;
  }

  async getSourceUsage(recommendationId: string): Promise<SourceUsage[]> {
    const rec = mockRecommendations.find((item) => item.id === recommendationId);
    if (!rec) {
      mockError(
        API_STATUS.NotFound,
        'recommendation_not_found',
        'That recommendation no longer exists.',
        'It may have been superseded by newer information.',
        'Refresh to see the current recommendations.',
      );
    }

    // Which evidence types this recommendation actually drew on.
    const citedTypes = new Set<EvidenceSourceType>(
      rec.evidence.map((evidence) => evidence.sourceType),
    );

    const usage = this.sources.map<SourceUsage>((source) => {
      const base = {
        sourceId: source.id,
        provider: source.provider,
        displayName: source.displayName,
      };

      // A source that cannot be reached is excluded with its real reason first —
      // permission problems trump relevance, because the user can act on them.
      if (!WORKING.has(source.status)) {
        return {
          ...base,
          included: false,
          reason:
            source.attentionReason ??
            'This source is not currently available to search.',
        };
      }

      if (citedTypes.has(source.evidenceType)) {
        return { ...base, included: true, reason: reasonFor(source.evidenceType) };
      }

      return {
        ...base,
        included: false,
        reason: 'No relevant data for this request.',
      };
    });

    const response = await mockRespond(usage);
    return response.data;
  }

  async getCoverage(recommendationId: string): Promise<KnowledgeCoverage> {
    const rec = mockRecommendations.find((item) => item.id === recommendationId);
    if (!rec) {
      mockError(
        API_STATUS.NotFound,
        'recommendation_not_found',
        'That recommendation no longer exists.',
        'It may have been superseded by newer information.',
        'Refresh to see the current recommendations.',
      );
    }

    // Coverage rises with the number and freshness of sources cited, and falls
    // when a source that would have helped is unavailable.
    const citedTypes = new Set(rec.evidence.map((evidence) => evidence.sourceType));
    const citedSources = this.sources.filter((source) =>
      citedTypes.has(source.evidenceType),
    );
    const citedFreshness = averageOf(citedSources.map((source) => source.freshness));

    const missingProviders = IMPROVEMENT_HINTS.filter((provider) => {
      const source = this.sources.find((item) => item.provider === provider);
      // "Missing" means present-but-unusable, or improves this kind of request.
      return source ? !WORKING.has(source.status) : true;
    });

    // Each missing improvement docks a fixed amount from an evidence-scaled base.
    const base = Math.min(100, 60 + rec.evidence.length * 8 + citedFreshness * 0.2);
    const coverage = clampScore(base - missingProviders.length * 6);

    const result: KnowledgeCoverage = {
      coverage: Math.round(coverage),
      missingProviders,
    };
    const response = await mockRespond(result);
    return response.data;
  }
}

function averageOf(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Human-readable inclusion reasons per evidence type. */
function reasonFor(type: EvidenceSourceType): string {
  const reasons: Partial<Record<EvidenceSourceType, string>> = {
    email: 'Contains recent, relevant discussion.',
    calendar: 'A related meeting falls within the window.',
    meeting_notes: 'Notes reference this decision.',
    document: 'Holds a document this depends on.',
    knowledge_base: 'Organizational knowledge applies here.',
    crm: 'Customer records are relevant.',
    project_update: 'Reflects the current project state.',
    task_history: 'Related tasks inform this.',
    chat: 'Recent conversation is relevant.',
  };
  return reasons[type] ?? 'Relevant to this request.';
}
