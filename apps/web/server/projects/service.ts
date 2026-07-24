import { and, desc, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { projects, users } from '@kloyya/db/schema';
import type { ProjectStatus } from '@kloyya/core';
import type { StartContext } from '../tenant';
import { type Task, listTasks } from '../tasks/service';

/**
 * Projects.
 *
 * Workspace-scoped and RLS-isolated, like every other tenant table. Ranking is
 * worst-health-first (the project needing attention leads), same policy the
 * mock encodes in `byHealthAsc`. `getHealth` has no AI health-analysis agent
 * behind it yet, so it derives a deterministic explanation from the stored
 * `healthScore`/`riskScore` rather than fabricating evidence it doesn't have —
 * honest under the DCTF Golden Rules until a real agent lands.
 */

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  ownerId: string | null;
  progress: number;
  riskScore: number;
  healthScore: number;
  deadline: string | null;
  organizationId: string;
  workspaceId: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ProjectDetail extends Project {
  ownerName: string;
  tasks: Task[];
}

export interface ProjectHealthDriver {
  label: string;
  effect: 'positive' | 'negative';
  detail: string;
}

export interface ProjectHealth {
  projectId: string;
  headline: string;
  drivers: [ProjectHealthDriver, ...ProjectHealthDriver[]];
  confidence: number;
}

const projectColumns = {
  id: projects.id,
  name: projects.name,
  status: projects.status,
  ownerId: projects.ownerId,
  progress: projects.progress,
  riskScore: projects.riskScore,
  healthScore: projects.healthScore,
  deadline: projects.deadline,
  organizationId: projects.organizationId,
  workspaceId: projects.workspaceId,
  createdBy: projects.createdBy,
  updatedBy: projects.updatedBy,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
  version: projects.version,
};

type ProjectRow = {
  id: string;
  name: string;
  status: ProjectStatus;
  ownerId: string | null;
  progress: number;
  riskScore: number;
  healthScore: number;
  deadline: Date | null;
  organizationId: string;
  workspaceId: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    ownerId: row.ownerId,
    progress: row.progress,
    riskScore: row.riskScore,
    healthScore: row.healthScore,
    deadline: row.deadline ? row.deadline.toISOString() : null,
    organizationId: row.organizationId,
    workspaceId: row.workspaceId,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

/** Worst health first — the project that needs attention leads. */
export async function listProjects(db: AppDb, ctx: StartContext): Promise<Project[]> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select(projectColumns)
      .from(projects)
      .where(and(eq(projects.workspaceId, ctx.workspaceId), isNull(projects.deletedAt)))
      .orderBy(projects.healthScore, desc(projects.updatedAt)),
  );
  return rows.map(toProject);
}

export interface CreateProjectInput {
  name: string;
  status?: ProjectStatus | undefined;
  ownerId?: string | null | undefined;
  progress?: number | undefined;
  riskScore?: number | undefined;
  healthScore?: number | undefined;
  deadline?: string | null | undefined;
}

export async function createProject(
  db: AppDb,
  ctx: StartContext,
  input: CreateProjectInput,
): Promise<Project> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .insert(projects)
      .values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        name: input.name,
        status: input.status ?? 'planning',
        ownerId: input.ownerId ?? ctx.userId,
        progress: input.progress ?? 0,
        riskScore: input.riskScore ?? 0,
        healthScore: input.healthScore ?? 100,
        deadline: input.deadline ? new Date(input.deadline) : null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning(projectColumns),
  );
  return toProject(rows[0]!);
}

export async function getProject(
  db: AppDb,
  ctx: StartContext,
  id: string,
): Promise<ProjectDetail | null> {
  const project = await withTenantScope(db, ctx.organizationId, async (tx) => {
    const rows = await tx
      .select(projectColumns)
      .from(projects)
      .where(
        and(eq(projects.workspaceId, ctx.workspaceId), eq(projects.id, id), isNull(projects.deletedAt)),
      )
      .limit(1);
    if (!rows[0]) return null;

    const owner = rows[0].ownerId
      ? await tx.select({ fullName: users.fullName }).from(users).where(eq(users.id, rows[0].ownerId)).limit(1)
      : [];

    return { row: rows[0], ownerName: owner[0]?.fullName ?? 'Unassigned' };
  });
  if (!project) return null;

  const { tasks: projectTasks } = await listTasks(db, ctx, { projectId: id, pageSize: 100 });

  return { ...toProject(project.row), ownerName: project.ownerName, tasks: projectTasks };
}

/**
 * A health analysis derived from the stored scores, since no health-analysis
 * agent exists yet to generate real drivers. Always returns something (unlike
 * the mock, which 404s when absent) — a deterministic read of numbers already
 * on the row is not a claim requiring a separate "analysis exists" record.
 */
export async function getHealth(
  db: AppDb,
  ctx: StartContext,
  id: string,
): Promise<ProjectHealth | null> {
  const rows = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select({
        healthScore: projects.healthScore,
        riskScore: projects.riskScore,
        progress: projects.progress,
        deadline: projects.deadline,
      })
      .from(projects)
      .where(
        and(eq(projects.workspaceId, ctx.workspaceId), eq(projects.id, id), isNull(projects.deletedAt)),
      )
      .limit(1),
  );
  const row = rows[0];
  if (!row) return null;

  const drivers: ProjectHealthDriver[] = [];
  if (row.progress >= 50) {
    drivers.push({
      label: 'Progress',
      effect: 'positive',
      detail: `${row.progress}% complete.`,
    });
  } else {
    drivers.push({
      label: 'Progress',
      effect: 'negative',
      detail: `Only ${row.progress}% complete so far.`,
    });
  }
  if (row.riskScore >= 50) {
    drivers.push({
      label: 'Risk',
      effect: 'negative',
      detail: `Risk score is ${row.riskScore} of 100.`,
    });
  } else {
    drivers.push({
      label: 'Risk',
      effect: 'positive',
      detail: `Risk score is a manageable ${row.riskScore} of 100.`,
    });
  }
  if (row.deadline) {
    const daysLeft = Math.ceil((row.deadline.getTime() - Date.now()) / 86_400_000);
    drivers.push(
      daysLeft < 0
        ? { label: 'Deadline', effect: 'negative', detail: 'The deadline has passed.' }
        : { label: 'Deadline', effect: daysLeft < 7 ? 'negative' : 'positive', detail: `${daysLeft} day(s) remaining.` },
    );
  }

  return {
    projectId: id,
    headline:
      row.healthScore >= 70
        ? 'This project is on track.'
        : row.healthScore >= 40
          ? 'This project needs attention.'
          : 'This project is at risk.',
    drivers: [drivers[0]!, ...drivers.slice(1)],
    // Derived-from-numbers, not a model's own estimate — kept moderate on purpose.
    confidence: 60,
  };
}
