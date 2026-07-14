'use client';

import { CalendarClock, CheckSquare, ShieldCheck, TriangleAlert } from 'lucide-react';
import { ExecutiveBrief, RecommendationCard } from '@/components/ai';
import { TrustedSearchIndicator } from '@/components/intelligence/trusted-search-indicator';
import {
  Card,
  CardActions,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  KpiCard,
  LoadingRegion,
  Skeleton,
  toast,
} from '@/components/ui';
import { toErrorPresentation } from '@/lib/error-presentation';
import {
  useDashboard,
  useRecordFeedback,
  useRecordOutcome,
} from '@/hooks/use-intelligence';
import { useAuth } from '@/providers/auth-provider';
import type { FeedbackRating, RecommendationOutcome } from '@/types/domain';
import { AgentActivityCard } from './agent-activity-card';
import { ConnectedSourcesCard } from './connected-sources-card';
import { ProjectHealthCard } from './project-health-card';
import { TodaysPrioritiesCard } from './todays-priorities-card';
import { UpcomingMeetingsCard } from './upcoming-meetings-card';

/**
 * The executive dashboard.
 *
 * Two source documents disagree about this screen. The V1 Build Spec lists
 * twelve simultaneous widgets; the Design Manifesto says "the dashboard is not a
 * homepage… if it doesn't matter today, it shouldn't occupy valuable space," and
 * Product Principle 3 names "dashboard clutter" as noise.
 *
 * The resolution: the widgets all exist, but the *service* filters
 * recommendations to what the dashboard channel permits (KDSE bands), and the
 * layout puts the single most important thing at full width with its reasoning
 * already open. Everything else is secondary, literally and visually.
 *
 * The goal, verbatim from the spec: "know what matters within five seconds."
 */
export function Dashboard() {
  const { session } = useAuth();
  const firstName = session?.user.fullName.split(' ').at(0) ?? 'there';

  return (
    <div className="space-y-6">
      {/*
        The greeting renders from the seeded session, immediately, on the server.
        Only the data region below swaps between skeleton, error, and content —
        so the page has a stable title and heading from the first paint rather
        than a full-page skeleton that then reflows.
      */}
      <header className="space-y-1">
        <h1 className="text-heading-m text-foreground font-semibold">
          {greeting()}, {firstName}.
        </h1>
        <p className="text-small text-muted-foreground">
          Here is what deserves your attention today.
        </p>
      </header>

      <DashboardBody />
    </div>
  );
}

/** Time-of-day greeting. Purely cosmetic; falls back to "Hello" off-hours edges. */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function DashboardBody() {
  const { data, isPending, isError, error, refetch } = useDashboard();
  const recordOutcome = useRecordOutcome();
  const recordFeedback = useRecordFeedback();

  if (isPending) return <DashboardSkeleton />;

  if (isError) {
    return (
      <Card>
        <ErrorState error={toErrorPresentation(error)} onRetry={() => void refetch()} />
      </Card>
    );
  }

  const [topRecommendation, ...restRecommendations] = data.recommendations;

  function onOutcome(id: string, outcome: RecommendationOutcome) {
    recordOutcome.mutate(
      { id, outcome },
      {
        onError: (mutationError) => {
          toast.error(toErrorPresentation(mutationError).title);
        },
      },
    );
  }

  function onRate(id: string, rating: FeedbackRating) {
    recordFeedback.mutate({ id, rating });
  }

  return (
    <div className="space-y-6">
      {/* Trusted Knowledge Search: the sources feeding today's intelligence,
          shown before the briefing so the user sees the ground it stands on. */}
      <TrustedSearchIndicator />

      <ExecutiveBrief briefing={data.briefing} />

      {/* KDS KPI components. Each one explains itself — the prop is required. */}
      <section aria-label="Workspace metrics">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Open tasks"
            value={String(data.metrics.openTasks)}
            explanation="Across every project you own or contribute to."
            icon={CheckSquare}
          />
          <KpiCard
            label="Meetings today"
            value={String(data.metrics.meetingsToday)}
            explanation="One of them will decide the Atlas timeline."
            icon={CalendarClock}
          />
          <KpiCard
            label="Projects at risk"
            value={String(data.metrics.projectsAtRisk)}
            explanation="Risk score above 70, or a milestone already missed."
            icon={TriangleAlert}
            trend={{ deltaPercent: 33.3, comparisonLabel: 'vs last week', sentiment: 'negative' }}
          />
          <KpiCard
            label="Trust score"
            value={`${data.metrics.trustScore}`}
            explanation="How well Kloyya can see your work. Rises as you connect more."
            icon={ShieldCheck}
            trend={{ deltaPercent: 4.2, comparisonLabel: 'vs last week', sentiment: 'positive' }}
          />
        </div>
      </section>

      {/*
        The single highest-scoring recommendation, at full width, expanded.
        Everything the user needs to act is visible without a click — including
        the evidence, because DCTF forbids a recommendation that cannot show
        its work.
      */}
      {topRecommendation ? (
        <section aria-label="What matters most today" className="space-y-4">
          <h2 className="text-title text-foreground font-semibold">
            What matters most today
          </h2>
          <RecommendationCard
            recommendation={topRecommendation}
            onOutcome={onOutcome}
            onRate={onRate}
            defaultExpanded
          />
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section aria-label="Recommendations" className="min-w-0 space-y-4 lg:col-span-2">
          <h2 className="text-title text-foreground font-semibold">
            Also worth your attention
          </h2>

          {restRecommendations.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-small text-muted-foreground">
                  Nothing else needs a decision today. That is a good sign.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {restRecommendations.map((recommendation) => (
                <RecommendationCard
                  key={recommendation.id}
                  recommendation={recommendation}
                  onOutcome={onOutcome}
                  onRate={onRate}
                />
              ))}
            </div>
          )}
        </section>

        <aside aria-label="Workspace overview" className="space-y-6">
          <TodaysPrioritiesCard tasks={data.priorities} />
          <UpcomingMeetingsCard meetings={data.upcomingMeetings} />
          <ProjectHealthCard projects={data.projects} />
          <ConnectedSourcesCard />
          <AgentActivityCard agents={data.agents} />
        </aside>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <LoadingRegion label="Preparing today's briefing" className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-40 w-full rounded-lg" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-32 rounded-lg" />
        ))}
      </div>

      <Skeleton className="h-80 w-full rounded-lg" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    </LoadingRegion>
  );
}

/** Shared chrome for the sidebar cards, so they cannot drift apart. */
export function SidebarCard({
  title,
  action,
  children,
}: {
  title: string;
  /** Optional header affordance, e.g. a "Manage" link. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {action ? <CardActions>{action}</CardActions> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
