import type { ProjectHealth } from '@/types/domain';
import { apiFetch } from '../http/transport';
import type { ProjectDetail, ProjectList, ProjectService } from './types';

/** The real ProjectService — maps one-to-one onto /v1/projects/*. */
export class HttpProjectService implements ProjectService {
  async listProjects(): Promise<ProjectList> {
    return apiFetch<ProjectList>('/v1/projects');
  }

  async getProject(id: string): Promise<ProjectDetail> {
    return apiFetch<ProjectDetail>(`/v1/projects/${encodeURIComponent(id)}`);
  }

  async getHealth(projectId: string): Promise<ProjectHealth> {
    return apiFetch<ProjectHealth>(`/v1/projects/${encodeURIComponent(projectId)}/health`);
  }
}
