'use client';

import { CalendarClock, Clock, ChevronDown, Flag, Lightbulb, Plus, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import {
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from '@/components/ui';
import { toErrorPresentation } from '@/lib/error-presentation';
import { useDashboard } from '@/hooks/use-intelligence';
import { useAuth } from '@/providers/auth-provider';
import { useDashboardIntroState } from '../hooks/use-dashboard-intro-state';
import { AskBox } from './ask-box';
import { ConnectedSourcesCard } from './connected-sources-card';
import { DashboardIntro } from './dashboard-intro';
import { DashboardTour } from './dashboard-tour';
import { KloyyaTipCard, productivityTip } from './kloyya-tip-card';
import { ProjectHealthCard } from './project-health-card';
import { RecentActivityCard } from './recent-activity-card';
import { RecentDecisionsCard } from './recent-decisions-card';
import { RecentMessagesCard } from './recent-messages-card';
import { StatRow, type Stat } from './stat-row';
import { TodaysBriefCard } from './todays-brief-card';
import { TodaysPrioritiesCard } from './todays-priorities-card';
import { UpcomingMeetingsCard } from './upcoming-meetings-card';
import { WhatsChangedCard } from './whats-changed-card';

/** A standard workday, for turning meeting load into a "time protected" read. */
const WORKDAY_HOURS = 8;

/**
 * Home.
 *
 * "Know what matters within five seconds" (Design Manifesto). Today's Brief —
 * an evidence-backed account of what actually happened, generated server-side
 * by generateBriefing — is the first thing on the page; Ask Kloyya is real and
 * stays reachable, but is no longer the entry point. A brief tells you what
 * happened without being asked; a chat box waits to be asked something.
 */
export function Dashboard() {
  const { session } = useAuth();
  const firstName = session?.user.fullName.split(' ').at(0) ?? 'there';
  const { hasSeenIntro, hasSeenTour, dismissIntro, completeTour } = useDashboardIntroState();

  return (
    <>
      {hasSeenIntro ? null : <DashboardIntro onDismiss={dismissIntro} />}
      <DashboardTour isVisible={hasSeenIntro && !hasSeenTour} onComplete={completeTour} />
      <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-heading-m text-foreground font-semibold">
            {greeting()}, {firstName} 👋
          </h1>
          <p className="text-small text-muted-foreground">
            Here&rsquo;s what&rsquo;s happening with your work today.
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              data-tour="new-button"
              leadingIcon={<Plus aria-hidden="true" />}
              trailingIcon={<ChevronDown aria-hidden="true" />}
            >
              New
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/tasks">New task</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/drafts">New draft</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/meetings">New meeting</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <DashboardBody />

      <div className="border-border text-caption text-subtle flex items-center justify-between gap-2 border-t pt-4">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck aria-hidden="true" className="size-3.5" />
          Your data is private, secure
        </span>
        <Link href="/trust" className="text-link inline-flex items-center gap-1 hover:underline">
          Trust Centre
        </Link>
      </div>
      </div>
    </>
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

  if (isPending) return <DashboardSkeleton />;

  if (isError) {
    return (
      <Card>
        <ErrorState error={toErrorPresentation(error)} onRetry={() => void refetch()} />
      </Card>
    );
  }

  const openTasks = data.priorities.filter((task) => task.status !== 'done');
  const highPriorityCount = openTasks.filter(
    (task) => task.priority === 'Critical' || task.priority === 'High',
  ).length;
  const pendingDecisions = data.recommendations.filter((rec) => rec.outcome === 'pending').length;

  // Time NOT in meetings, out of a standard workday — a real number derived
  // from the calendar, not a fabricated "productivity" score.
  const meetingHours =
    data.upcomingMeetings.reduce(
      (total, meeting) =>
        total + (new Date(meeting.endsAt).getTime() - new Date(meeting.startsAt).getTime()),
      0,
    ) /
    1000 /
    60 /
    60;
  const protectedHours = Math.max(0, WORKDAY_HOURS - meetingHours);

  const stats: Stat[] = [
    { icon: Lightbulb, tone: 'info', value: pendingDecisions, label: 'Decisions waiting' },
    { icon: Flag, tone: 'critical', value: data.metrics.projectsAtRisk, label: 'Projects at risk' },
    { icon: CalendarClock, tone: 'positive', value: data.metrics.meetingsToday, label: 'Meetings today' },
    { icon: Clock, tone: 'warning', value: Math.round(protectedHours), label: 'Focus hours today' },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Main column: today's brief first, then what's changed, the working
          cards, and Ask Kloyya last — reachable, not the entry point. */}
      <div className="min-w-0 space-y-6 lg:col-span-2">
        <TodaysBriefCard briefing={data.briefing} />

        <StatRow stats={stats} />

        <WhatsChangedCard recommendations={data.recommendations} />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <RecentActivityCard />
          <TodaysPrioritiesCard tasks={data.priorities} />
          <ConnectedSourcesCard />
        </div>

        <AskBox />
      </div>

      {/* Right rail: what's coming, projects to watch, decisions already made,
          who's reached out, and today's nudge. */}
      <aside className="space-y-6 lg:col-span-1">
        <UpcomingMeetingsCard meetings={data.upcomingMeetings} />
        <ProjectHealthCard projects={data.projects} />
        <RecentDecisionsCard recommendations={data.recommendations} />
        <RecentMessagesCard />
        <KloyyaTipCard
          tip={productivityTip({
            focusHours: protectedHours,
            highPriorityCount,
            meetingCount: data.upcomingMeetings.length,
          })}
        />
      </aside>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <LoadingRegion label="Preparing your dashboard" className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Skeleton className="h-28 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-44 w-full rounded-lg" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-56 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="space-y-6 lg:col-span-1">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-48 rounded-lg" />
        ))}
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
    // No h-full here: in a CSS-grid row the cards already stretch to equal
    // height, while in the vertical right rail they must size to their content
    // (h-full would make each card fill the whole column).
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {action ? <CardActions>{action}</CardActions> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
