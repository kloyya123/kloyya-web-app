import type {
  ConnectedSource,
  IntelligenceHealth,
  KnowledgeCoverage,
  SourceCategory,
  SourceUsage,
} from '@/types/sources';
import { apiFetch } from '../http/transport';
import type { SourcesService } from './types';

/** The real SourcesService — maps onto /v1/sources/*. */
export class HttpSourcesService implements SourcesService {
  async listSources(category?: SourceCategory): Promise<ConnectedSource[]> {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return apiFetch<ConnectedSource[]>(`/v1/sources${params}`);
  }

  async getHealth(): Promise<IntelligenceHealth> {
    return apiFetch<IntelligenceHealth>('/v1/sources/health');
  }

  async getSourceUsage(recommendationId: string): Promise<SourceUsage[]> {
    return apiFetch<SourceUsage[]>(`/v1/sources/usage/${encodeURIComponent(recommendationId)}`);
  }

  async getCoverage(recommendationId: string): Promise<KnowledgeCoverage> {
    return apiFetch<KnowledgeCoverage>(
      `/v1/sources/knowledge-coverage/${encodeURIComponent(recommendationId)}`,
    );
  }
}
