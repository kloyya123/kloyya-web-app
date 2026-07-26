import type { FeedbackRating, Recommendation, RecommendationOutcome } from '@/types/domain';
import { apiFetch } from '../http/transport';
import type { DashboardData, IntelligenceService } from './types';

/**
 * The real IntelligenceService.
 *
 * Only `getDashboard` has a backend today, and it returns what the workspace
 * actually contains: its own tasks and the calendar events its connectors have
 * landed. The briefing, recommendation and agent pipelines do not exist yet, so
 * the API returns null and empty arrays for those rather than fixtures.
 *
 * The three recommendation methods throw. That is deliberate and is the whole
 * point of this class: the routes that use them (/recommendations) are the ones
 * that were silently rendering demo content to real users. An explicit failure
 * is visible and gets fixed; a fake success is a lie that ships. They are wired
 * the moment the endpoint exists.
 */
function notBuilt(what: string): never {
  throw new Error(
    `${what} has no backend yet. The recommendation pipeline is not built, and ` +
      'Kloyya will not show generated content that is not derived from your data.',
  );
}

export class HttpIntelligenceService implements IntelligenceService {
  async getDashboard(): Promise<DashboardData> {
    return apiFetch<DashboardData>('/v1/dashboard');
  }

  async listRecommendations(): Promise<Recommendation[]> {
    return notBuilt('The recommendation feed');
  }

  async recordOutcome(_id: string, _outcome: RecommendationOutcome): Promise<Recommendation> {
    return notBuilt('Recording a recommendation outcome');
  }

  async recordFeedback(_id: string, _rating: FeedbackRating): Promise<Recommendation> {
    return notBuilt('Recording recommendation feedback');
  }
}
