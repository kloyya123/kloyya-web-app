import { byDecisionScoreDesc, isAllowedOnChannel } from '@/lib/decision-score';
import { allNotifications } from '@/mock/notification-store';
import {
  MOCK_NOW,
  mockAgents,
  mockBriefing,
  mockMeetings,
  mockProjects,
  mockRecommendations,
  mockTasks,
  mockWorkspace,
} from '@/mock/organization';
import { API_STATUS } from '@/types/api';
import type {
  FeedbackRating,
  Recommendation,
  RecommendationOutcome,
} from '@/types/domain';
import { mockError, mockRespond } from '../http/mock-transport';
import type { DashboardData, IntelligenceService } from './types';

/**
 * The mock intelligence service.
 *
 * Two behaviours here are policy, not mock convenience, and must survive the
 * move to a real backend:
 *
 *   1. Recommendations are filtered by `isAllowedOnChannel(priority, 'dashboard')`.
 *      KDSE says a Background item is "indexed only, no proactive surface", so
 *      the dashboard never receives one. The filter lives in the service, not in
 *      a widget, because a widget that forgets it would leak.
 *
 *   2. They are then ranked by decision score, descending. KDSE ranks competing
 *      items by score, not recency.
 */

/** Mutable copy, so outcomes persist for the session like a real backend would. */
const recommendations = new Map(
  mockRecommendations.map((rec) => [rec.id, { ...rec }] as const),
);

export class MockIntelligenceService implements IntelligenceService {
  async getDashboard(): Promise<DashboardData> {
    const all = [...recommendations.values()];

    const visible = all
      .filter((rec) => isAllowedOnChannel(rec.priority, 'dashboard'))
      .sort(byDecisionScoreDesc);

    const data: DashboardData = {
      briefing: mockBriefing,
      recommendations: visible,
      priorities: [...mockTasks].sort((a, b) => b.aiPriorityScore - a.aiPriorityScore),
      projects: [...mockProjects].sort((a, b) => b.riskScore - a.riskScore),
      upcomingMeetings: [...mockMeetings]
        .filter((meeting) => new Date(meeting.startsAt).getTime() > MOCK_NOW.getTime())
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      agents: mockAgents,
      // Read through the shared store, not the raw mock array: the bell renders
      // from this payload, and marking a notification read must be true here too.
      notifications: allNotifications().sort(byDecisionScoreDesc),
      metrics: {
        openTasks: mockTasks.filter((task) => task.status !== 'done').length,
        meetingsToday: mockMeetings.filter((meeting) => isToday(meeting.startsAt)).length,
        projectsAtRisk: mockProjects.filter((project) => project.status === 'at_risk')
          .length,
        trustScore: mockWorkspace.trustScore,
      },
    };

    const response = await mockRespond(data);
    return response.data;
  }

  async listRecommendations(): Promise<Recommendation[]> {
    // Same delivery-channel discipline as the dashboard, but the feed's channel
    // admits Medium items the dashboard's does not. The filter lives here, not in
    // the page, so a page cannot accidentally surface a Background item.
    const visible = [...recommendations.values()]
      .filter((rec) => isAllowedOnChannel(rec.priority, 'recommendation_feed'))
      .sort(byDecisionScoreDesc);

    const response = await mockRespond(visible);
    return response.data;
  }

  async recordOutcome(
    id: string,
    outcome: RecommendationOutcome,
  ): Promise<Recommendation> {
    return this.patch(id, { outcome });
  }

  async recordFeedback(id: string, rating: FeedbackRating): Promise<Recommendation> {
    return this.patch(id, { feedbackRating: rating });
  }

  private async patch(
    id: string,
    changes: Partial<Recommendation>,
  ): Promise<Recommendation> {
    const existing = recommendations.get(id);
    if (!existing) {
      mockError(
        API_STATUS.NotFound,
        'recommendation_not_found',
        'That recommendation no longer exists.',
        'It may have been superseded by newer information.',
        'Refresh to see the current recommendations.',
      );
    }

    const updated: Recommendation = {
      ...existing,
      ...changes,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    };
    recommendations.set(id, updated);

    const response = await mockRespond(updated);
    return response.data;
  }
}

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = MOCK_NOW;
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  );
}
