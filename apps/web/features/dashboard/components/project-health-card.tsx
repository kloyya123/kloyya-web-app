'use client';

import { FolderKanban } from 'lucide-react';
import { Badge, EmptyState, Progress, type BadgeTone } from '@/components/ui';
import type { Project, ProjectStatus } from '@/types/domain';
import { SidebarCard } from './dashboard';

const STATUS_TONE: Record<ProjectStatus, BadgeTone> = {
  planning: 'neutral',
  active: 'success',
  at_risk: 'danger',
  paused: 'warning',
  complete: 'success',
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'On track',
  at_risk: 'At risk',
  paused: 'Paused',
  complete: 'Complete',
};

/**
 * Ordered by risk score, descending.
 *
 * The Design Manifesto warns against "meaningless charts", and a donut of
 * project statuses would be exactly that. A progress bar per project is not
 * decoration: it is the one number a reader wants, drawn to scale.
 */
export function ProjectHealthCard({ projects }: { projects: Project[] }) {
  return (
    <SidebarCard title="Projects to watch">
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No active projects."
          description="Connect a project tool, and Kloyya will start tracking risk for you."
        />
      ) : (
        <ul className="space-y-4">
          {projects.map((project) => (
            <li key={project.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-small text-foreground min-w-0 truncate">
                  {project.name}
                </p>
                <Badge tone={STATUS_TONE[project.status]} className="shrink-0">
                  {STATUS_LABEL[project.status]}
                </Badge>
              </div>

              <Progress
                value={project.progress}
                label={`${project.name} is ${project.progress}% complete`}
              />

              <p className="text-caption text-subtle">
                {project.progress}% complete &middot; health {project.healthScore}/100
              </p>
            </li>
          ))}
        </ul>
      )}
    </SidebarCard>
  );
}
