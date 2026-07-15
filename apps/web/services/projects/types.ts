import type { Project, ProjectHealth, Task } from '@/types/domain';

export interface ProjectList {
  /** Worst health first — the project that needs attention leads. */
  projects: Project[];
}

/** A project with its owner resolved and its own tasks attached. */
export interface ProjectDetail extends Project {
  ownerName: string;
  tasks: Task[];
}

/**
 * The projects contract.
 *
 * A real backend joins the project record to its owner and its tasks, and the
 * health agent produces the analysis. The shape here is that end state; only the
 * transport changes.
 */
export interface ProjectService {
  listProjects(): Promise<ProjectList>;

  /** Throws 404 for an unknown id. */
  getProject(id: string): Promise<ProjectDetail>;

  /**
   * The health analysis. Throws 404 when none exists — a healthy, unremarkable
   * project may not warrant one, and the detail view renders fine without it.
   */
  getHealth(projectId: string): Promise<ProjectHealth>;
}
