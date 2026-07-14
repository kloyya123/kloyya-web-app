import { byHealthAsc } from '@/lib/project-health';
import { mockProjectHealth } from '@/mock/projects';
import { mockProjects, mockTasks, mockTeammates, mockUser } from '@/mock/organization';
import { API_STATUS } from '@/types/api';
import type { ProjectHealth } from '@/types/domain';
import { mockError, mockRespond } from '../http/mock-transport';
import type { ProjectDetail, ProjectList, ProjectService } from './types';

/** Every user in the org, for resolving an owner id to a name. */
const usersById = new Map(
  [mockUser, ...mockTeammates].map((user) => [user.id, user]),
);

/**
 * Mock projects.
 *
 * Ranking is delegated to the pure project-health policy (worst first), and the
 * detail view is assembled here — owner resolved, tasks joined by projectId —
 * so a real backend swaps this file without any component learning that the
 * join moved. Health analyses are keyed separately and 404 when absent, the
 * same absent-is-valid contract as briefings.
 */
export class MockProjectService implements ProjectService {
  async listProjects(): Promise<ProjectList> {
    const projects = [...mockProjects].sort(byHealthAsc);
    const { data } = await mockRespond<ProjectList>({ projects });
    return data;
  }

  async getProject(id: string): Promise<ProjectDetail> {
    const project = mockProjects.find((candidate) => candidate.id === id);
    if (!project) {
      mockError(
        API_STATUS.NotFound,
        'project_not_found',
        'That project no longer exists.',
        'It may have been archived, or the link may be out of date.',
        'Browse the projects board for the current work.',
      );
    }

    const detail: ProjectDetail = {
      ...project,
      ownerName: usersById.get(project.ownerId)?.fullName ?? 'Unassigned',
      tasks: mockTasks.filter((task) => task.projectId === project.id),
    };

    const { data } = await mockRespond(detail);
    return data;
  }

  async getHealth(projectId: string): Promise<ProjectHealth> {
    const health = mockProjectHealth[projectId];
    if (!health) {
      mockError(
        API_STATUS.NotFound,
        'project_health_not_available',
        'No health analysis for this project.',
        'Kloyya prepares one when a project’s health needs explaining.',
        'A steady project may not have one yet.',
      );
    }

    const { data } = await mockRespond(health);
    return data;
  }
}
