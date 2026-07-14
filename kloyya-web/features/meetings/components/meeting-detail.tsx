'use client';

import {
  ArrowLeft,
  CheckSquare,
  Eye,
  Gavel,
  ListChecks,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { ConfidenceBadge, EvidenceViewer } from '@/components/ai';
import {
  Avatar,
  AvatarFallback,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  LoadingRegion,
  Separator,
  Skeleton,
} from '@/components/ui';
import { toErrorPresentation } from '@/lib/error-presentation';
import { formatDate, formatTime, initials } from '@/lib/format';
import type { Meeting, MeetingBriefing } from '@/types/domain';
import { useBriefing, useMeeting } from '../hooks/use-meetings';

/**
 * One meeting, on whichever side of it you are.
 *
 * Upcoming (summary === null): the AI briefing — why it matters, what to walk
 * out with, talking points, risks — with its confidence and evidence, plus the
 * agenda. Past: the summary with its confidence, then action items, decisions,
 * and follow-ups. The layout is data-driven; no clock is consulted here.
 */
export function MeetingDetail({ id }: { id: string }) {
  const { data: meeting, isPending, isError, error, refetch } = useMeeting(id);

  if (isPending) {
    return (
      <LoadingRegion label="Loading the meeting" className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </LoadingRegion>
    );
  }

  if (isError) {
    return (
      <Card>
        <ErrorState error={toErrorPresentation(error)} onRetry={() => void refetch()} />
      </Card>
    );
  }

  const isUpcoming = meeting.summary === null;

  return (
    <div className="space-y-6">
      <Link
        href="/meetings"
        className="text-caption text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        All meetings
      </Link>

      <header className="space-y-3">
        <h1 className="text-heading-m text-foreground font-semibold text-balance">
          {meeting.title}
        </h1>
        <p className="text-small text-muted-foreground tabular-nums">
          {formatDate(meeting.startsAt)} &middot; {formatTime(meeting.startsAt)}–
          {formatTime(meeting.endsAt)}
        </p>

        <ul className="flex flex-wrap items-center gap-2" aria-label="Participants">
          {meeting.participants.map((participant) => (
            <li key={participant.userId} className="flex items-center gap-1.5">
              <Avatar size="xs">
                <AvatarFallback>{initials(participant.fullName)}</AvatarFallback>
              </Avatar>
              <span className="text-caption text-muted-foreground">
                {participant.fullName}
              </span>
            </li>
          ))}
        </ul>
      </header>

      {isUpcoming ? <UpcomingBody meeting={meeting} /> : <PastBody meeting={meeting} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Before the meeting
// ---------------------------------------------------------------------------

function UpcomingBody({ meeting }: { meeting: Meeting }) {
  const { data: briefing, isPending } = useBriefing(meeting.id, true);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="min-w-0 space-y-6 lg:col-span-2">
        {isPending ? (
          <LoadingRegion label="Preparing your briefing">
            <Skeleton className="h-72 rounded-lg" />
          </LoadingRegion>
        ) : briefing ? (
          <BriefingCard briefing={briefing} />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-small text-muted-foreground">
                No briefing for this one — Kloyya prepares them when a meeting
                carries a decision or a risk worth walking in ready for.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <aside className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Agenda</CardTitle>
          </CardHeader>
          <CardContent>
            {meeting.agenda.length === 0 ? (
              <p className="text-small text-muted-foreground">
                No agenda yet. Kloyya will draft one from the meeting&rsquo;s context.
              </p>
            ) : (
              <ol className="space-y-2">
                {meeting.agenda.map((item, index) => (
                  <li key={item} className="text-small text-foreground flex gap-2.5">
                    <span className="text-subtle tabular-nums">{index + 1}.</span>
                    {item}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function BriefingCard({ briefing }: { briefing: MeetingBriefing }) {
  return (
    <Card className="border-executive-purple/25">
      <CardHeader className="flex-col items-stretch gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-caption text-ai flex items-center gap-1.5 font-medium">
            <Sparkles aria-hidden="true" className="size-3.5" />
            AI briefing
          </p>
          <ConfidenceBadge confidence={briefing.confidence} />
        </div>
        <h2 className="text-title text-foreground font-semibold text-balance">
          {briefing.headline}
        </h2>
        <p className="text-small text-muted-foreground">
          <span className="text-foreground font-medium">Walk out with:</span>{' '}
          {briefing.objective}
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <section>
          <h3 className="text-caption text-muted-foreground mb-2 font-medium tracking-wide uppercase">
            Talking points
          </h3>
          <ul className="space-y-2">
            {briefing.talkingPoints.map((point) => (
              <li key={point} className="text-small text-foreground flex gap-2.5">
                <span aria-hidden="true" className="text-ai">
                  &middot;
                </span>
                {point}
              </li>
            ))}
          </ul>
        </section>

        {briefing.risks.length > 0 ? (
          <section>
            <h3 className="text-caption text-muted-foreground mb-2 font-medium tracking-wide uppercase">
              Watch for
            </h3>
            <ul className="space-y-2">
              {briefing.risks.map((risk) => (
                <li key={risk} className="text-small text-muted-foreground flex gap-2.5">
                  <Eye aria-hidden="true" className="text-caution mt-0.5 size-3.5 shrink-0" />
                  {risk}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Separator />
        <EvidenceViewer evidence={briefing.evidence} />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// After the meeting
// ---------------------------------------------------------------------------

function PastBody({ meeting }: { meeting: Meeting }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-col items-stretch gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle as="h2">Summary</CardTitle>
            {meeting.summaryConfidence !== null ? (
              <ConfidenceBadge confidence={meeting.summaryConfidence} />
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-body text-muted-foreground leading-relaxed">
            {meeting.summary}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <OutcomeCard
          title="Action items"
          icon={<CheckSquare aria-hidden="true" className="text-link size-4" />}
          items={meeting.actionItems}
          emptyText="Nothing was assigned."
        />
        <OutcomeCard
          title="Decisions"
          icon={<Gavel aria-hidden="true" className="text-positive size-4" />}
          items={meeting.decisions}
          emptyText="No decisions were recorded."
        />
        <OutcomeCard
          title="Follow-ups"
          icon={<ListChecks aria-hidden="true" className="text-caution size-4" />}
          items={meeting.followUps}
          emptyText="Nothing to watch."
        />
      </div>
    </div>
  );
}

function OutcomeCard({
  title,
  icon,
  items,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle as="h2">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-small text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item} className="text-small text-foreground flex gap-2.5">
                <span aria-hidden="true" className="text-subtle">
                  &middot;
                </span>
                {item}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
