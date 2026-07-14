import { beforeEach, describe, expect, it } from 'vitest';
import { isApiError } from '../http/errors';
import { configureMockTransport } from '../http/mock-transport';
import { MockProjectService } from './mock-project-service';

describe('MockProjectService', () => {
  const service = new MockProjectService();

  beforeEach(() => {
    configureMockTransport({ instant: true, failureRate: 0 });
  });

  describe('listProjects', () => {
    it('orders projects worst-health first', async () => {
      const { projects } = await service.listProjects();
      const scores = projects.map((p) => p.healthScore);
      expect(scores).toEqual([...scores].sort((a, b) => a - b));
      expect(projects[0]?.id).toBe('proj_atlas');
    });
  });

  describe('getProject', () => {
    it('resolves the owner name and the project’s own tasks', async () => {
      const project = await service.getProject('proj_atlas');
      expect(project.ownerName).toBe('Daniel Reyes');
      expect(project.tasks.length).toBeGreaterThan(0);
      expect(project.tasks.every((t) => t.projectId === 'proj_atlas')).toBe(true);
    });

    it('throws a non-retryable 404 for an unknown id', async () => {
      await expect(service.getProject('proj_nope')).rejects.toSatisfy(
        (error: unknown) => isApiError(error) && error.httpStatus === 404 && !error.isRetryable,
      );
    });
  });

  describe('getHealth', () => {
    it('returns a headline and non-empty drivers for an analyzed project', async () => {
      const health = await service.getHealth('proj_atlas');
      expect(health.headline.length).toBeGreaterThan(0);
      expect(health.drivers.length).toBeGreaterThan(0);
    });

    it('throws 404 for a project with no analysis', async () => {
      await expect(service.getHealth('proj_meridian')).rejects.toSatisfy(
        (error: unknown) => isApiError(error) && error.httpStatus === 404,
      );
    });
  });
});
