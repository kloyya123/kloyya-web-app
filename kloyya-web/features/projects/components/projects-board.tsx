'use client';

import { CalendarClock, FolderKanban, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from '@/components/ui';
import { now } from '@/lib/clock';
import { daysUntil } from '@/lib/project-health';
import { toErrorPresentation } from '@/lib/error-presentation';
import { formatDate } from '@/lib/format';
import type { Project } from '@/types/domain';
import { healthMeta, STATUS_META } from '../project-meta';
import { useProjects } from '../hooks/use-projects';
import { MetricBar } from './metric-bar';

/**
 * The projects board: every project, the one in trouble first.
 *
 * Worst-health-first ordering is the point — the Manifesto's "know what matters"
 * means Atlas leads, not the healthy projects. Each card carries its status, its
 * health, its progress, and how close its deadline is.
 */
export function ProjectsBoard() {
  const { data, isPending, isError, error, refetch } = useProjects();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-heading-m text-foreground font-semibold">Projects</h1>
        <p className="text-small text-muted-foreground">
          Health-ranked, so the project that needs you is the first you see.
        </p>
      </header>

      {isPending ? (
        <LoadingRegion label="Loading your projects" className="space-y-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </LoadingRegion>
      ) : isError ? (
        <Card>
          <ErrorState error={toErrorPresentation(error)} onRetry={() => void refetch()} />
        </Card>
      ) : data.projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title="No projects yet."
            description="When work is organized into projects, they’ll appear here ranked by health."
          />
        </Card>
      ) : (
        <ul className="space-y-4">
          {data.projects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const status = STATUS_META[project.status];
  const health = healthMeta(project.healthScore);
  const days = daysUntil(project.deadline, now());

  return (
    <Link href={`/projects/${project.id}`} className="group block rounded-lg">
      <Card className="group-hover:border-muted transition-colors">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h2 className="text-title text-foreground font-semibold">{project.name}</h2>
              {project.deadline ? (
                <p className="text-caption text-subtle flex items-center gap-1.5">
                  <CalendarClock aria-hidden="true" className="size-3.5" />
                  <span className="tabular-nums">{formatDate(project.deadline)}</span>
                  {days !== null ? <DeadlineHint days={days} /> : null}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge tone={status.tone} withDot={project.status === 'at_risk'}>
                {status.label}
              </Badge>
              <Badge tone={health.tone}>
                {health.label} · {project.healthScore}
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MetricBar label="Progress" value={project.progress} />
            <MetricBar label="Risk" value={project.riskScore} tone="warning" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function DeadlineHint({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span className="text-danger inline-flex items-center gap-1 font-medium">
        <TriangleAlert aria-hidden="true" className="size-3.5" />
        {Math.abs(days)}d overdue
      </span>
    );
  }
  const urgent = days <= 30;
  return (
    <span className={urgent ? 'text-caution font-medium' : ''}>
      · in {days} {days === 1 ? 'day' : 'days'}
    </span>
  );
}

