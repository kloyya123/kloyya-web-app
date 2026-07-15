'use client';

import {
  ArrowLeft,
  CheckSquare,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { ConfidenceBadge } from '@/components/ai';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from '@/components/ui';
import { now } from '@/lib/clock';
import { daysUntil } from '@/lib/project-health';
import { toErrorPresentation } from '@/lib/error-presentation';
import { formatDate } from '@/lib/format';
import type { ProjectHealth, Task } from '@/types/domain';
import type { ProjectDetail as ProjectDetailData } from '@/services';
import { healthMeta, STATUS_META } from '../project-meta';
import { useProject, useProjectHealth } from '../hooks/use-projects';
import { MetricBar } from './metric-bar';

/**
 * One project: its status and health up top, the AI health analysis — why the
 * score reads the way it does — beside its metrics, and the tasks that carry it.
 */
export function ProjectDetail({ id }: { id: string }) {
  const { data: project, isPending, isError, error, refetch } = useProject(id);

  if (isPending) {
    return (
      <LoadingRegion label="Loading the project" className="space-y-4">
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

  const status = STATUS_META[project.status];
  const health = healthMeta(project.healthScore);
  const days = daysUntil(project.deadline, now());

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="text-caption text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        All projects
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone} withDot={project.status === 'at_risk'}>
            {status.label}
          </Badge>
          <Badge tone={health.tone}>
            {health.label} · {project.healthScore}
          </Badge>
        </div>
        <h1 className="text-heading-m text-foreground font-semibold text-balance">
          {project.name}
        </h1>
        <p className="text-small text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <User aria-hidden="true" className="size-3.5" />
            {project.ownerName}
          </span>
          {project.deadline ? (
            <span className="tabular-nums">
              Due {formatDate(project.deadline)}
              {days !== null && days >= 0 ? ` · in ${days} days` : ''}
              {days !== null && days < 0 ? ` · ${Math.abs(days)}d overdue` : ''}
            </span>
          ) : null}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <HealthAnalysis project={project} />
        </div>
        <aside className="space-y-6">
          <MetricsCard project={project} />
        </aside>
      </div>

      <TasksCard tasks={project.tasks} />
    </div>
  );
}

function HealthAnalysis({ project }: { project: ProjectDetailData }) {
  const { data: health, isPending } = useProjectHealth(project.id, true);

  if (isPending) {
    return (
      <LoadingRegion label="Preparing the health analysis">
        <Skeleton className="h-64 rounded-lg" />
      </LoadingRegion>
    );
  }

  if (!health) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-small text-muted-foreground">
            No analysis needed — this project is steady. Kloyya prepares one when a
            project’s health needs explaining.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <HealthCard health={health} />;
}

function HealthCard({ health }: { health: ProjectHealth }) {
  return (
    <Card className="border-executive-purple/25">
      <CardHeader className="flex-col items-stretch gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-caption text-ai flex items-center gap-1.5 font-medium">
            <Sparkles aria-hidden="true" className="size-3.5" />
            Health analysis
          </p>
          <ConfidenceBadge confidence={health.confidence} />
        </div>
        <h2 className="text-title text-foreground font-semibold text-balance">
          {health.headline}
        </h2>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {health.drivers.map((driver) => {
            const positive = driver.effect === 'positive';
            const Icon = positive ? TrendingUp : TrendingDown;
            return (
              <li key={driver.label} className="flex gap-3">
                <Icon
                  aria-hidden="true"
                  className={positive ? 'text-positive mt-0.5 size-4 shrink-0' : 'text-caution mt-0.5 size-4 shrink-0'}
                />
                <div className="space-y-0.5">
                  <p className="text-small text-foreground font-medium">
                    {driver.label}
                    <span className="sr-only">{positive ? ' (helping)' : ' (hurting)'}</span>
                  </p>
                  <p className="text-small text-muted-foreground">{driver.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function MetricsCard({ project }: { project: ProjectDetailData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <MetricBar label="Progress" value={project.progress} />
        <MetricBar label="Risk" value={project.riskScore} tone="warning" />
        <MetricBar label="Health" value={project.healthScore} tone="success" />
      </CardContent>
    </Card>
  );
}

function TasksCard({ tasks }: { tasks: Task[] }) {
  return (
    <Card>
      <CardHeader className="flex-col items-stretch gap-1">
        <div className="flex items-center gap-2">
          <CheckSquare aria-hidden="true" className="text-link size-4" />
          <CardTitle as="h2">Tasks</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-small text-muted-foreground">No tasks on this project yet.</p>
        ) : (
          <ul className="divide-border divide-y">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="text-small text-foreground min-w-0 truncate">{task.title}</span>
                <Badge tone={task.priority === 'Critical' ? 'danger' : task.priority === 'High' ? 'warning' : 'neutral'}>
                  {task.priority}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/tasks"
          className="text-caption text-link mt-4 inline-flex rounded-sm font-medium"
        >
          Open in Tasks →
        </Link>
      </CardContent>
    </Card>
  );
}
