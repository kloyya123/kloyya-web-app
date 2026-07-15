import type {
  Agent,
  AppNotification,
  Briefing,
  FeedbackRating,
  Meeting,
  Project,
  Recommendation,
  RecommendationOutcome,
  Task,
} from '@/types/domain';

/**
 * Everything the dashboard reads.
 *
 * One service rather than six, because the dashboard is a single coherent view
 * of one moment: a briefing whose recommendations cite the same projects the
 * risk widget lists. Splitting it would let those drift out of sync at the
 * seam, which is the one thing the mock data exists to prevent.
 */
export interface IntelligenceService {
  /** Today's briefing, with its recommendations resolved and ranked. */
  getDashboard(): Promise<DashboardData>;

  /**
   * The full recommendation feed — everything permitted on the
   * `recommendation_feed` channel, ranked by decision score. Wider than the
   * dashboard: it carries the Medium items the dashboard is not allowed to
   * surface, which is the reason a dedicated feed exists.
   */
  listRecommendations(): Promise<Recommendation[]>;

  /** Records what the user did with a recommendation (accepted, dismissed…). */
  recordOutcome(id: string, outcome: RecommendationOutcome): Promise<Recommendation>;

  /** Records what the user thought of it. Orthogonal to the outcome. */
  recordFeedback(id: string, rating: FeedbackRating): Promise<Recommendation>;
}

export interface DashboardData {
  briefing: Briefing;
  /** Ranked by decision score, filtered to what the dashboard channel permits. */
  recommendations: Recommendation[];
  /** Ranked by AI priority score. */
  priorities: Task[];
  projects: Project[];
  upcomingMeetings: Meeting[];
  agents: Agent[];
  notifications: AppNotification[];
  metrics: DashboardMetrics;
}

export interface DashboardMetrics {
  openTasks: number;
  meetingsToday: number;
  projectsAtRisk: number;
  /** DCTF workspace Trust Score, 0–100. */
  trustScore: number;
}
