'use client';

import {
  ArrowLeft,
  ArrowUpRight,
  CheckSquare,
  Clock,
  FolderKanban,
  Mail,
} from 'lucide-react';
import Link from 'next/link';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from '@/components/ui';
import { roleLabel } from '@/lib/org-roles';
import { toErrorPresentation } from '@/lib/error-presentation';
import { initials } from '@/lib/format';
import type { Project, Task } from '@/types/domain';
import { roleTone } from '../role-meta';
import { useMember } from '../hooks/use-organization';

/**
 * One member: who they are, the projects they own, and the tasks they carry.
 *
 * Projects and tasks link out to their own rich surfaces rather than re-rendering
 * them here — this page answers "who is this person and what are they on", and
 * hands off for the detail.
 */
export function MemberProfile({ id }: { id: string }) {
  const { data: profile, isPending, isError, error, refetch } = useMember(id);

  if (isPending) {
    return (
      <LoadingRegion label="Loading the profile" className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
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

  const { user, ownedProjects, tasks } = profile;

  return (
    <div className="space-y-6">
      <Link
        href="/organization"
        className="text-caption text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        Organization
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <Avatar size="lg">
          <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
        </Avatar>
        <div className="space-y-1.5">
          <h1 className="text-heading-m text-foreground font-semibold">{user.fullName}</h1>
          <p className="text-small text-muted-foreground">{user.jobTitle}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Badge tone={roleTone(user.role)}>{roleLabel(user.role)}</Badge>
            <span className="text-caption text-subtle inline-flex items-center gap-1">
              <Clock aria-hidden="true" className="size-3.5" />
              {user.timezone.replace('_', ' ')}
            </span>
            <a
              href={`mailto:${user.email}`}
              className="text-caption text-link inline-flex items-center gap-1 rounded-sm"
            >
              <Mail aria-hidden="true" className="size-3.5" />
              {user.email}
            </a>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <OwnedProjects projects={ownedProjects} />
        <AssignedTasks tasks={tasks} />
      </div>
    </div>
  );
}

const STATUS_TEXT: Record<Project['status'], string> = {
  planning: 'Planning',
  active: 'Active',
  at_risk: 'At risk',
  paused: 'Paused',
  complete: 'Complete',
};

function OwnedProjects({ projects }: { projects: Project[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FolderKanban aria-hidden="true" className="text-executive-purple size-4" />
          <CardTitle as="h2">Owns {projects.length > 0 ? `(${projects.length})` : ''}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <p className="text-small text-muted-foreground">Owns no projects.</p>
        ) : (
          <ul className="space-y-1.5">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="border-border hover:bg-hover flex items-center justify-between gap-2 rounded-md border p-2.5"
                >
                  <span className="min-w-0">
                    <span className="text-small text-foreground block truncate">{project.name}</span>
                    <span className="text-caption text-subtle block">{STATUS_TEXT[project.status]}</span>
                  </span>
                  <ArrowUpRight aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AssignedTasks({ tasks }: { tasks: Task[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckSquare aria-hidden="true" className="text-link size-4" />
          <CardTitle as="h2">Tasks {tasks.length > 0 ? `(${tasks.length})` : ''}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-small text-muted-foreground">No assigned tasks.</p>
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
